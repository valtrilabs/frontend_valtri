import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { PrinterIcon, ChartBarIcon, ClipboardDocumentListIcon, PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function Admin() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', category: '', price: '', is_available: true });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Pending Orders');

  // Check if admin is logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsLoggedIn(true);
      else router.push('/admin');
    };
    checkSession();
  }, [router]);

  // Fetch pending orders
  useEffect(() => {
    async function fetchOrders() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
        const response = await fetch(`${apiUrl}/api/admin/orders`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setOrders(data);
      } catch (err) {
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
      setError(`Login failed: ${err.message}`);
    }
  };

  // Mark order as paid
  const markAsPaid = async (orderId) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/api/orders/${orderId}/pay`, { method: 'PATCH' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setOrders(orders.filter(order => order.id !== orderId));
    } catch (err) {
      setError(`Failed to mark order as paid: ${err.message}`);
    }
  };

  // Add menu item
  const addMenuItem = async () => {
    if (!newItem.name || !newItem.price) {
      setError('Name and price are required');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .insert([{
          name: newItem.name,
          category: newItem.category || '',
          price: parseFloat(newItem.price),
          is_available: newItem.is_available
        }])
        .select();
      if (error) throw error;
      setMenuItems([...menuItems, data[0]]);
      setNewItem({ name: '', category: '', price: '', is_available: true });
    } catch (err) {
      setError(`Failed to add item: ${err.message}`);
    }
  };

  // Remove menu item
  const removeMenuItem = async (itemId) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
      setMenuItems(menuItems.filter(item => item.id !== itemId));
    } catch (err) {
      setError(`Failed to remove item: ${err.message}`);
    }
  };

  // Toggle menu item availability
  const toggleAvailability = async (itemId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !currentStatus })
        .eq('id', itemId);
      if (error) throw error;
      setMenuItems(menuItems.map(item =>
        item.id === itemId ? { ...item, is_available: !currentStatus } : item
      ));
    } catch (err) {
      setError(`Failed to update availability: ${err.message}`);
    }
  };

  // Print bill (80mm thermal printer)
  const printBill = async (order) => {
    try {
      // Load escpos-buffer dynamically
      const { default: Escpos } = await import('https://cdn.jsdelivr.net/npm/escpos-buffer@0.4.1/+esm');
      
      // Request USB device (assumes thermal printer supports WebUSB)
      const device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x0483 }] }); // Adjust vendorId for your printer
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      const encoder = new TextEncoder();
      const writer = Escpos.getUSBPrinter(device);

      // ESC/POS commands for 80mm receipt
      writer
        .init()
        .align('center')
        .size(2, 2)
        .text('Gsaheb Cafe')
        .size(1, 1)
        .text(`Order #${order.order_number || order.id}`)
        .text(`Table ${order.tables?.number || order.table_id}`)
        .text(`Date: ${new Date(order.created_at).toLocaleString('en-IN')}`)
        .newline()
        .align('left')
        .text('--------------------------------')
        .tableCustom([
          { text: 'Item', align: 'left', width: 0.6 },
          { text: 'Qty', align: 'right', width: 0.15 },
          { text: 'Price', align: 'right', width: 0.25 }
        ]);

      order.items.forEach(item => {
        writer.tableCustom([
          { text: item.name.slice(0, 20), align: 'left', width: 0.6 },
          { text: item.quantity || 1, align: 'right', width: 0.15 },
          { text: `₹${(item.price * (item.quantity || 1)).toFixed(2)}`, align: 'right', width: 0.25 }
        ]);
      });

      const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      writer
        .text('--------------------------------')
        .tableCustom([
          { text: 'Total', align: 'left', width: 0.6 },
          { text: '', align: 'right', width: 0.15 },
          { text: `₹${total.toFixed(2)}`, align: 'right', width: 0.25 }
        ])
        .newline()
        .align('center')
        .text('Thank you for dining with us!')
        .newline()
        .cut()
        .close();

      // Send data to printer
      const buffer = writer.buffer();
      await device.transferOut(1, buffer); // Adjust endpoint as needed
      await device.close();
    } catch (err) {
      setError(`Failed to print bill: ${err.message}. Ensure printer is connected and supports WebUSB.`);
    }
  };

  // Export today's orders as CSV
  const exportTodaysOrders = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaysOrders = orders.filter(order =>
      new Date(order.created_at).toISOString().split('T')[0] === today
    );

    const csv = [
      'Order Number,Table Number,Items,Total,Status,Created At',
      ...todaysOrders.map(order => {
        const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        return `${order.order_number || order.id},${order.tables?.number || order.table_id},${JSON.stringify(order.items)},${total.toFixed(2)},${order.status},${order.created_at}`;
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${today}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Data analytics calculations
  const getAnalytics = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaysOrders = orders.filter(order =>
      new Date(order.created_at).toISOString().split('T')[0] === today
    );

    const totalOrders = todaysOrders.length;
    const totalRevenue = todaysOrders.reduce((sum, order) =>
      sum + order.items.reduce((s, item) => s + (item.price * (item.quantity || 1)), 0), 0
    );

    // Top 5 items by quantity
    const itemCounts = {};
    todaysOrders.forEach(order => {
      order.items.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
      });
    });
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Orders by hour
    const ordersByHour = Array(24).fill(0);
    todaysOrders.forEach(order => {
      const hour = new Date(order.created_at).getHours();
      ordersByHour[hour]++;
    });

    return { totalOrders, totalRevenue, topItems, ordersByHour };
  };

  const analytics = getAnalytics();

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
          {error && <p className="text-red-500 mb-4 text-center" role="alert">{error}</p>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-3 w-full mb-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-3 w-full mb-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Password"
          />
          <button
            className="bg-blue-600 text-white px-4 py-3 rounded-lg w-full hover:bg-blue-700 transition"
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
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg p-4 fixed h-full">
        <h1 className="text-2xl font-bold mb-8 text-gray-800">Gsaheb Cafe Admin</h1>
        <nav>
          {['Pending Orders', 'Menu Management', 'Data Analytics'].map(tab => (
            <button
              key={tab}
              className={`w-full text-left py-3 px-4 mb-2 rounded-lg flex items-center gap-2 ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
            >
              {tab === 'Pending Orders' && <ClipboardDocumentListIcon className="h-5 w-5" />}
              {tab === 'Menu Management' && <PlusIcon className="h-5 w-5" />}
              {tab === 'Data Analytics' && <ChartBarIcon className="h-5 w-5" />}
              {tab}
            </button>
          ))}
        </nav>
        <button
          className="w-full mt-4 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition"
          onClick={() => supabase.auth.signOut().then(() => setIsLoggedIn(false))}
          aria-label="Logout"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1 p-8">
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6" role="alert">
            {error}
          </div>
        )}

        {/* Pending Orders Tab */}
        {activeTab === 'Pending Orders' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Pending Orders</h2>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                onClick={exportTodaysOrders}
                aria-label="Export today's orders as CSV"
              >
                Export Today's Orders
              </button>
            </div>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center">No pending orders</p>
            ) : (
              <div className="grid gap-6">
                {orders.map(order => {
                  const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
                  const formattedDate = new Date(order.created_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });
                  return (
                    <div key={order.id} className="bg-white p-6 rounded-lg shadow-md">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">Order #{order.order_number || order.id}</h3>
                          <p className="text-sm text-gray-500">{formattedDate}</p>
                          <p className="text-sm text-gray-500">Table {order.tables?.number || order.table_id}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                            onClick={() => markAsPaid(order.id)}
                            aria-label={`Mark order ${order.order_number || order.id} as paid`}
                          >
                            Mark as Paid
                          </button>
                          <button
                            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
                            onClick={() => printBill(order)}
                            aria-label={`Print bill for order ${order.order_number || order.id}`}
                          >
                            <PrinterIcon className="h-5 w-5" />
                            Print Bill
                          </button>
                        </div>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Item</th>
                            <th className="text-right py-2">Qty</th>
                            <th className="text-right py-2">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, index) => (
                            <tr key={index}>
                              <td className="py-2">{item.name}</td>
                              <td className="text-right py-2">{item.quantity || 1}</td>
                              <td className="text-right py-2">₹{(item.price * (item.quantity || 1)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex justify-between mt-4 font-semibold">
                        <span>Total</span>
                        <span>₹{total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Menu Management Tab */}
        {activeTab === 'Menu Management' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Menu Management</h2>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">Add New Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Item Name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Item Name"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Category"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  className="border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Price"
                />
              </div>
              <label className="flex items-center mt-4">
                <input
                  type="checkbox"
                  checked={newItem.is_available}
                  onChange={(e) => setNewItem({ ...newItem, is_available: e.target.checked })}
                  className="mr-2"
                  aria-label="Item Available"
                />
                Available
              </label>
              <button
                className="mt-4 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700"
                onClick={addMenuItem}
                aria-label="Add menu item"
              >
                Add Item
              </button>
            </div>
            <h3 className="text-lg font-semibold mb-4">Current Menu</h3>
            <table className="w-full bg-white rounded-lg shadow-md">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-right py-3 px-4">Price</th>
                  <th className="text-center py-3 px-4">Available</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {menuItems.map(item => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3 px-4">{item.name}</td>
                    <td className="py-3 px-4">{item.category || '-'}</td>
                    <td className="text-right py-3 px-4">₹{item.price.toFixed(2)}</td>
                    <td className="text-center py-3 px-4">
                      {item.is_available ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" />
                      ) : (
                        <XCircleIcon className="h-6 w-6 text-red-500 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-3 px-4 flex gap-2 justify-center">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => toggleAvailability(item.id, item.is_available)}
                        aria-label={`Toggle availability for ${item.name}`}
                      >
                        {item.is_available ? 'Make Unavailable' : 'Make Available'}
                      </button>
                      <button
                        className="text-red-600 hover:text-red-800"
                        onClick={() => removeMenuItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Data Analytics Tab */}
        {activeTab === 'Data Analytics' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Data Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">Total Orders Today</h3>
                <p className="text-3xl font-bold text-blue-600">{analytics.totalOrders}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">Total Revenue Today</h3>
                <p className="text-3xl font-bold text-green-600">₹{analytics.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">Top 5 Items</h3>
                <ul>
                  {analytics.topItems.map((item, index) => (
                    <li key={index} className="flex justify-between">
                      <span>{item.name}</span>
                      <span>{item.count} sold</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md col-span-1 md:col-span-2 lg:col-span-3">
                <h3 className="text-lg font-semibold mb-2">Orders by Hour</h3>
                <div className="flex gap-2 flex-wrap">
                  {analytics.ordersByHour.map((count, hour) => (
                    <div key={hour} className="text-center">
                      <p className="text-sm">{hour}:00</p>
                      <div
                        className="bg-blue-600 w-8 h-16 rounded"
                        style={{ height: `${count * 10}px` }}
                      ></div>
                      <p className="text-sm">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}