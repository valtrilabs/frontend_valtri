import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function Table() {
  const router = useRouter();
  const { id } = router.query;
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if user has an active order
  useEffect(() => {
    const orderId = localStorage.getItem('orderId');
    if (orderId) {
      router.push(`/order/${orderId}`);
    }
  }, [router]);

  // Fetch menu items
  useEffect(() => {
    async function fetchMenu() {
      const { data } = await supabase.from('menu_items').select('*').eq('is_available', true);
      setMenu(data);
      setLoading(false);
    }
    fetchMenu();
  }, []);

  // Add to cart
  const addToCart = (item) => {
    setCart([...cart, { item_id: item.id, name: item.name, price: item.price }]);
  };

  // Place order
  const placeOrder = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      console.log('PlaceOrder - API URL:', apiUrl);
      console.log('PlaceOrder - Payload:', JSON.stringify({ table_id: parseInt(id), items: cart }));
      const response = await fetch(`${apiUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: parseInt(id), items: cart }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });
      console.log('PlaceOrder - Response status:', response.status);
      const order = await response.json();
      console.log('PlaceOrder - Response order:', order);
      setLoading(false);
      if (!response.ok || !order.id) {
        console.error('Order error:', order.error || `HTTP ${response.status}`);
        return alert(`Failed to place order: ${order.error || response.statusText}`);
      }
      localStorage.setItem('orderId', order.id);
      router.push(`/order/${order.id}`);
    } catch (err) {
      setLoading(false);
      console.error('Fetch error:', err.message);
      alert(`Failed to place order: ${err.message}`);
    }
  };

  if (loading) return <div className="text-center mt-10">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Table {id} - Menu</h1>
      <div className="grid gap-4">
        {menu.map(item => (
          <div key={item.id} className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold">{item.name}</h2>
            <p>${item.price.toFixed(2)}</p>
            <button
              className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
              onClick={() => addToCart(item)}
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <h2 className="text-xl font-bold">Cart</h2>
        {cart.length === 0 ? (
          <p>Cart is empty</p>
        ) : (
          <ul>
            {cart.map((item, index) => (
              <li key={index}>{item.name} - ${item.price.toFixed(2)}</li>
            ))}
          </ul>
        )}
        <button
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
          onClick={placeOrder}
          disabled={cart.length === 0 || loading}
        >
          Place Order
        </button>
      </div>
    </div>
  );
}