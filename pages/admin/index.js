import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function Admin() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', price: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState(null);

  // Check if admin is logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsLoggedIn(true);
    };
    checkSession();
  }, []);

  // Fetch pending orders
  useEffect(() => {
    async function fetchOrders() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
        console.log('Admin - Fetching orders from:', `${apiUrl}/api/admin/orders`);
        const response = await fetch(`${apiUrl}/api/admin/orders`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('Admin - Orders response:', data);
        setOrders(data);
      } catch (err) {
        console.error('Admin - Fetch orders error:', err.message);
        setError(`Failed to fetch orders: ${err.message}`);
      }
    }
    if (isLoggedIn) fetchOrders();
  }, [isLoggedIn]);

  // Fetch menu items
  useEffect(() => {
    async function fetchMenu() {
      try {
        const { data, error } = await supabase.from('menu_items').select('*');
        if (error) throw error;
        setMenuItems(data);
      } catch (err) {
        console.error('Admin - Fetch menu error:', err.message);
        setError(`Failed to fetch menu: ${err.message}`);
      }
    }
    if (isLoggedIn) fetchMenu();
  }, [isLoggedIn]);

  // Admin login
  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setIsLoggedIn(true);
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  };

  // Mark order as paid
  const markAsPaid = async (orderId) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      console.log('Admin - Marking order as paid:', `${apiUrl}/api/orders/${orderId}/pay`);
      const response = await fetch(`${apiUrl}/api/orders/${orderId}/pay`, { method: 'PATCH' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      console.log('Admin - Order marked as paid:', orderId);
      setOrders(orders.filter(order => order.id !== orderId));
    } catch (err) {
      console.error('Admin - Mark as paid error:', err.message);
      alert(`Failed to mark order as paid: ${err.message}`);
    }
  };

  // Add new menu item
  const addMenuItem = async () => {
    if (!newItem.name || !newItem.price) return alert('Fill all fields');
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .insert([{ name: newItem.name, price: parseFloat(newItem.price), category: '', is_available: true }])
        .select();
      if (error) throw error;
      setMenuItems([...menuItems, data[0]]);
      setNewItem({ name: '', price: '' });
    } catch (err) {
      alert(`Failed to add item: ${err.message}`);
    }
  };

  // Export orders
  const exportOrders = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
    window.location.href = `${apiUrl}/api/admin/orders/export`;
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded shadow">
          <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 w-full mb-4"
            aria-label="Email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full mb-4"
            aria-label="Password"
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={handleLogin}
            aria-label="Login"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <button
        className="mb-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        onClick={() => supabase.auth.signOut().then(() => setIsLoggedIn(false))}
        aria-label="Logout"
      >
        Logout
      </button>
      {error && <p className="text-red-500 mb-4" role="alert">{error}</p>}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Pending Orders</h2>
        {orders.length === 0 ? (
          <p>No pending orders</p>
        ) : (
          <div className="grid gap-4">
            {orders.map(order => {
              const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
              const formattedDate = new Date(order.created_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });
              return (
                <div key={order.id} className="bg-white p-4 rounded shadow">
                  <div className="mb-2">
                    <p className="font-semibold">Order #{order.order_number || order.id}</p>
                    <p className="text-sm text-gray-500">{formattedDate}</p>
                    <p className="text-sm text-gray-500">Table {order.tables?.number || order.table_id}</p>
                  </div>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span>
                          {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
                        </span>
                        <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-semibold">Total: ₹{total.toFixed(2)}</p>
                  <button
                    className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                    onClick={() => markAsPaid(order.id)}
                    aria-label={`Mark order ${order.order_number || order.id} as paid`}
                  >
                    Mark as Paid
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <button
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          onClick={exportOrders}
          aria-label="Export orders as CSV"
        >
          Export Orders (CSV)
        </button>
      </div>
      <div>
        <h2 className="text-xl font-bold">Manage Menu</h2>
        <div className="bg-white p-4 rounded shadow">
          <input
            type="text"
            placeholder="Item Name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            className="border p-2 w-full mb-4"
            aria-label="Item Name"
          />
          <input
            type="number"
            placeholder="Price"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            className="border p-2 w-full mb-4"
            aria-label="Price"
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={addMenuItem}
            aria-label="Add menu item"
          >
            Add Item
          </button>
        </div>
        <h3 className="mt-4 font-semibold">Current Menu</h3>
        {menuItems.map(item => (
          <div key={item.id} className="bg-white p-4 rounded shadow mt-2">
            <p>{item.name} - ₹{item.price.toFixed(2)} ({item.is_available ? 'Available' : 'Unavailable'})</p>
          </div>
        ))}
      </div>
    </div>
  );
}