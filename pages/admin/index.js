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

  // Check if admin is logged in
  useEffect(() => {
    const session = supabase.auth.getSession();
    if (session) setIsLoggedIn(true);
  }, []);

  // Fetch pending orders
  useEffect(() => {
    async function fetchOrders() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
        console.log('Admin - Fetching orders from:', `${apiUrl}/api/admin/orders`);
        const response = await fetch(`${apiUrl}/api/admin/orders`);
        const data = await response.json();
        console.log('Admin - Orders response:', data);
        setOrders(data);
      } catch (err) {
        console.error('Admin - Fetch orders error:', err.message);
        alert(`Failed to fetch orders: ${err.message}`);
      }
    }
    if (isLoggedIn) fetchOrders();
  }, [isLoggedIn]);

  // Fetch menu items
  useEffect(() => {
    async function fetchMenu() {
      const { data } = await supabase.from('menu_items').select('*');
      setMenuItems(data);
    }
    if (isLoggedIn) fetchMenu();
  }, [isLoggedIn]);

  // Admin login
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    setIsLoggedIn(true);
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
    const { data, error } = await supabase
      .from('menu_items')
      .insert([{ name: newItem.name, price: parseFloat(newItem.price), is_available: true }])
      .select();
    if (error) return alert(error.message);
    setMenuItems([...menuItems, data[0]]);
    setNewItem({ name: '', price: '' });
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
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full mb-4"
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={handleLogin}
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
        className="mb-4 bg-red-500 text-white px-4 py-2 rounded"
        onClick={() => supabase.auth.signOut().then(() => setIsLoggedIn(false))}
      >
        Logout
      </button>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Pending Orders</h2>
        {orders.length === 0 ? (
          <p>No pending orders</p>
        ) : (
          <div className="grid gap-4">
            {orders.map(order => (
              <div key={order.id} className="bg-white p-4 rounded shadow">
                <p>Table {order.tables.number}</p>
                <ul>
                  {order.items.map((item, index) => (
                    <li key={index}>{item.name} - ${item.price.toFixed(2)}</li>
                  ))}
                </ul>
                <button
                  className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
                  onClick={() => markAsPaid(order.id)}
                >
                  Mark as Paid
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          onClick={exportOrders}
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
          />
          <input
            type="number"
            placeholder="Price"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            className="border p-2 w-full mb-4"
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={addMenuItem}
          >
            Add Item
          </button>
        </div>
        <h3 className="mt-4 font-semibold">Current Menu</h3>
        {menuItems.map(item => (
          <div key={item.id} className="bg-white p-4 rounded shadow mt-2">
            <p>{item.name} - ${item.price.toFixed(2)} ({item.is_available ? 'Available' : 'Unavailable'})</p>
          </div>
        ))}
      </div>
    </div>
  );
}