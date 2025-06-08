import React from 'react'; // Added to fix ReferenceError
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { format, add } from 'date-fns';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center mt-10 text-red-500" role="alert">
          Something went wrong: {this.state.errorMessage}. Please try refreshing the page.
        </div>
      );
    }
    return this.props.children;
  }
}

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

  // Fetch order details with retry logic
  const fetchOrder = async () => {
    if (!orderId) return;
    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}`, {
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(30000),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        if (data.status === 'paid') {
          localStorage.removeItem('orderId');
          router.replace('/blocked');
          return;
        }
        setOrder(data);
        setLoading(false);
        return;
      } catch (err) {
        attempts++;
        console.error(`Fetch order attempt ${attempts} failed:`, err.message);
        if (attempts === maxRetries) {
          setError('Failed to load order after 3 attempts. The order may not exist or you lack access.');
          setLoading(false);
          setTimeout(() => {
            localStorage.removeItem('orderId');
            router.replace('/blocked');
          }, 3000);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  // Fetch order on mount
  useEffect(() => {
    fetchOrder();
  }, [orderId, router]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!orderId) return;

    const subscription = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          console.log('Real-time update received:', payload);
          if (!payload.new || typeof payload.new !== 'object') {
            console.warn('Invalid real-time payload:', payload);
            return;
          }
          const { id, status, items, table_id, tables, order_number, created_at } = payload.new;
          if (!id || !items || !table_id) {
            console.warn('Incomplete real-time payload:', payload.new);
            return;
          }
          if (status === 'paid') {
            localStorage.removeItem('orderId');
            router.replace('/blocked');
          } else {
            setOrder({
              id,
              status,
              items: Array.isArray(items) ? items : [],
              table_id,
              tables: tables || { number: table_id.toString() },
              order_number: order_number || id,
              created_at: created_at || new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [orderId, router]);

  // Calculate total safely
  const total = Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0)
    : 0;

  if (loading) return <div className="text-center mt-10" role="status">Loading order...</div>;
  if (error) return <div className="text-center mt-10 text-red-500" role="alert">{error} Redirecting...</div>;
  if (!order) return <div className="text-center mt-10" role="alert">Order not found</div>;

  const formattedDate = formatToIST(order.created_at);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 p-4">
        <h1
          className="text-2xl font-bold mb-4"
          aria-label={`Order Summary for Table ${order.tables?.number || order.table_id}`}
        >
          Order Summary - Table {order.tables?.number || order.table_id}
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
            {Array.isArray(order.items) && order.items.length > 0 ? (
              order.items.map((item, index) => (
                <li key={index} className="flex justify-between">
                  <span>
                    {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
                  </span>
                  <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                </li>
              ))
            ) : (
              <li className="text-gray-500">No items in this order.</li>
            )}
          </ul>
          <p className="font-semibold">Total: ₹{total.toFixed(2)}</p>
          <p className="mt-4">Status: {order.status || 'Pending'}</p>
        </div>
      </div>
    </ErrorBoundary>
  );
}