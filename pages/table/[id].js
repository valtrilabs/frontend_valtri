import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { supabase } from '../../lib/supabase';

const fetcher = (url) => fetch(url).then(res => res.json());

export default function Table() {
  const router = useRouter();
  const { id } = router.query;
  const [cart, setCart] = useState([]);
  const [isAppending, setIsAppending] = useState(false);
  const [appendOrderId, setAppendOrderId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCartModal, setShowCartModal] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has an active order
  useEffect(() => {
    async function checkActiveOrder() {
      const orderId = localStorage.getItem('orderId');
      if (orderId && !localStorage.getItem('appendOrder')) {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('id, status')
            .eq('id', orderId)
            .single();
          if (error || !data) {
            console.log('Invalid orderId, clearing localStorage:', orderId);
            localStorage.removeItem('orderId');
            return;
          }
          if (data.status === 'pending') {
            router.push(`/order/${orderId}`);
          } else {
            localStorage.removeItem('orderId');
          }
        } catch (err) {
          console.error('Error checking order:', err.message);
          localStorage.removeItem('orderId');
        }
      }
    }
    checkActiveOrder();
  }, [router]);

  // Check for append order
  useEffect(() => {
    const appendOrder = localStorage.getItem('appendOrder');
    if (appendOrder) {
      const { orderId, items } = JSON.parse(appendOrder);
      setCart(items);
      setIsAppending(true);
      setAppendOrderId(orderId);
    }
  }, []);

  // Fetch menu items
  const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const { data: menu, error: fetchError, isLoading } = useSWR(`${apiUrl}/api/menu`, fetcher);

  // Unique categories
  const categories = ['All', ...new Set(menu?.map(item => item.category).filter(Boolean))];

  // Filtered menu
  const filteredMenu = selectedCategory === 'All' ? menu : menu?.filter(item => item.category === selectedCategory);

  // Handle errors
  useEffect(() => {
    if (fetchError) {
      setError('Failed to load menu. Please try again.');
    }
  }, [fetchError]);

  // Add to cart
  const addToCart = (item) => {
    const newCart = [...cart, { item_id: item.id, name: item.name, price: item.price, category: item.category }];
    setCart(newCart);
    setShowCartModal(true);
    // Auto-close modal after 3 seconds
    setTimeout(() => setShowCartModal(false), 3000);
    console.log('Analytics - Item added:', { item_id: item.id, name: item.name, timestamp: new Date().toISOString() });
  };

  // Calculate total
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  // Place new order
  const placeOrder = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    try {
      setError(null);
      console.log('PlaceOrder - API URL:', apiUrl);
      console.log('PlaceOrder - Payload:', JSON.stringify({ table_id: parseInt(id), items: cart }));
      const response = await fetch(`${apiUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: parseInt(id), items: cart }),
        signal: AbortSignal.timeout(30000),
      });
      console.log('PlaceOrder - Response status:', response.status);
      const order = await response.json();
      if (!response.ok || !order.id) {
        throw new Error(order.error || `HTTP ${response.status}`);
      }
      localStorage.setItem('orderId', order.id);
      router.push(`/order/${order.id}`);
    } catch (err) {
      console.error('PlaceOrder error:', err.message);
      setError(`Failed to place order: ${err.message}`);
    }
  };

  // Update existing order
  const updateOrder = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    try {
      setError(null);
      console.log('UpdateOrder - API URL:', `${apiUrl}/api/orders/${appendOrderId}`);
      console.log('UpdateOrder - Payload:', JSON.stringify({ items: cart }));
      const response = await fetch(`${apiUrl}/api/orders/${appendOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
        signal: AbortSignal.timeout(30000),
      });
      console.log('UpdateOrder - Response status:', response.status);
      const order = await response.json();
      if (!response.ok || !order.id) {
        throw new Error(order.error || `HTTP ${response.status}`);
      }
      localStorage.removeItem('appendOrder');
      setIsAppending(false);
      setAppendOrderId(null);
      localStorage.setItem('orderId', order.id);
      router.push(`/order/${order.id}`);
    } catch (err) {
      console.error('UpdateOrder error:', err.message);
      setError(`Failed to update order: ${err.message}`);
    }
  };

  // Close modal with keyboard (Escape key)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowCartModal(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  if (isLoading) return <div className="text-center mt-10" role="status">Loading menu...</div>;
  if (error) return <div className="text-center mt-10 text-red-500" role="alert">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4" aria-label={`Menu for Table ${id}`}>Table {id} - Menu</h1>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Menu categories">
        {categories.map(category => (
          <button
            key={category}
            className={`px-4 py-2 rounded ${selectedCategory === category ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setSelectedCategory(category)}
            role="tab"
            aria-selected={selectedCategory === category}
            aria-controls="menu-items"
          >
            {category}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div id="menu-items" className="grid gap-4" role="region" aria-live="polite">
        {filteredMenu?.length === 0 ? (
          <p>No items in this category.</p>
        ) : (
          filteredMenu.map(item => (
            <div key={item.id} className="bg-white p-4 rounded shadow">
              <h2 className="font-semibold">{item.name}</h2>
              <p>₹{item.price.toFixed(2)}</p>
              <button
                className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                onClick={() => addToCart(item)}
                aria-label={`Add ${item.name} to cart`}
              >
                Add to Cart
              </button>
            </div>
          ))
        )}
      </div>

      {/* Cart Modal */}
      {showCartModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Cart contents"
        >
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Your Cart</h2>
            {cart.length === 0 ? (
              <p>Cart is empty</p>
            ) : (
              <>
                <ul className="mb-4">
                  {cart.map((item, index) => (
                    <li key={index} className="flex justify-between">
                      <span>{item.name}</span>
                      <span>₹{item.price.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <p className="font-semibold">Total: ₹{total.toFixed(2)}</p>
              </>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                onClick={() => setShowCartModal(false)}
                aria-label="Close cart"
              >
                Close
              </button>
              {cart.length > 0 && (
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  onClick={isAppending ? updateOrder : placeOrder}
                  aria-label={isAppending ? 'Update order' : 'Place order'}
                >
                  {isAppending ? 'Update Order' : 'Place Order'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart Summary */}
      <div className="mt-6 sticky bottom-0 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold">Cart</h2>
        {cart.length === 0 ? (
          <p>Cart is empty</p>
        ) : (
          <>
            <ul className="mb-2">
              {cart.map((item, index) => (
                <li key={index} className="flex justify-between">
                  <span>{item.name}</span>
                  <span>₹{item.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="font-semibold">Total: ₹{total.toFixed(2)}</p>
            <button
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
              onClick={isAppending ? updateOrder : placeOrder}
              disabled={cart.length === 0}
              aria-label={isAppending ? 'Update order' : 'Place order'}
            >
              {isAppending ? 'Update Order' : 'Place Order'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}