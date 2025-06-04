import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import {
  PrinterIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, add } from 'date-fns';

export default function Admin() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [paidOrders, setPaidOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', category: '', price: '', is_available: true, image: null });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('activeTab') || 'Pending Orders' : 'Pending Orders';
  });
  const [editingOrder, setEditingOrder] = useState(null);
  const [editedItems, setEditedItems] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    dateRange: 'today',
    customStart: new Date(),
    customEnd: new Date(),
    statuses: ['paid'],
    page: 1,
    perPage: 10,
  });
  const [exportType, setExportType] = useState('order');
  const [exportFilters, setExportFilters] = useState({
    startDate: new Date(),
    endDate: new Date(),
    statuses: ['paid'],
  });
  const [viewingOrder, setViewingOrder] = useState(null);
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [paymentType, setPaymentType] = useState('');
  const [editItemImages, setEditItemImages] = useState({});

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoggedIn(false);
        router.push('/admin/login');
      } else {
        setIsLoggedIn(true);
        fetchOrders();
        fetchPaidOrders();
        fetchMenuItems();
        fetchRevenue();
      }
    };
    checkSession();
  }, [router]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          item_id,
          quantity,
          note,
          menu_items (name, price)
        )
      `)
      .in('status', ['pending', 'accepted', 'in_progress', 'ready'])
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setOrders(data);
    }
  };

  const fetchPaidOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          item_id,
          quantity,
          note,
          menu_items (name, price)
        )
      `)
      .eq('status', 'paid')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setPaidOrders(data);
    }
  };

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('name');
    if (error) {
      setError(error.message);
    } else {
      setMenuItems(data);
    }
  };

  const fetchRevenue = async () => {
    const startOfWeek = format(new Date(), 'yyyy-MM-dd');
    const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
    const endOfWeek = format(add(new Date(), { days: 7 }), 'yyyy-MM-dd');
    const endOfMonth = format(add(new Date(startOfMonth), { months: 1 }), 'yyyy-MM-dd');

    const { data: weeklyData } = await supabase
      .from('orders')
      .select('total')
      .eq('status', 'paid')
      .gte('created_at', startOfWeek)
      .lte('created_at', endOfWeek);
    const weekly = weeklyData?.reduce((sum, order) => sum + order.total, 0) || 0;
    setWeeklyRevenue(weekly);

    const { data: monthlyData } = await supabase
      .from('orders')
      .select('total')
      .eq('status', 'paid')
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth);
    const monthly = monthlyData?.reduce((sum, order) => sum + order.total, 0) || 0;
    setMonthlyRevenue(monthly);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setIsLoggedIn(true);
      router.push('/admin');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    router.push('/admin/login');
  };

  const updateOrderStatus = async (orderId, status) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    if (error) {
      setError(error.message);
    } else {
      fetchOrders();
      fetchPaidOrders();
    }
  };

  const editOrder = async (order) => {
    setEditingOrder(order);
    setEditedItems(
      order.order_items.map((item) => ({
        id: item.id,
        item_id: item.item_id,
        quantity: item.quantity,
        note: item.note,
        name: item.menu_items.name,
        price: item.menu_items.price,
      }))
    );
  };

  const saveEditedOrder = async () => {
    try {
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', editingOrder.id);
      if (deleteError) throw deleteError;

      const newItems = editedItems.map((item) => ({
        order_id: editingOrder.id,
        item_id: item.item_id,
        quantity: item.quantity,
        note: item.note,
      }));

      const { error: insertError } = await supabase
        .from('order_items')
        .insert(newItems);
      if (insertError) throw insertError;

      const total = editedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const { error: updateError } = await supabase
        .from('orders')
        .update({ total })
        .eq('id', editingOrder.id);
      if (updateError) throw updateError;

      setEditingOrder(null);
      setEditedItems([]);
      fetchOrders();
    } catch (err) {
      setError(err.message);
    }
  };

  const addMenuItem = async () => {
    if (!newItem.name || !newItem.price) {
      setError('Name and price are required');
      return;
    }
    try {
      let imageUrl = '';
      if (newItem.image) {
        const fileExt = newItem.image.name.split('.').pop();
        const fileName = `${Date.now()}_${newItem.name.replace(/\s+/g, '_')}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, newItem.image, {
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from('menu_items')
        .insert([{
          name: newItem.name,
          category: newItem.category || '',
          price: parseFloat(newItem.price),
          is_available: newItem.is_available,
          image_url: imageUrl || null,
        }])
        .select();
      if (error) throw error;
      setMenuItems([...menuItems, data[0]]);
      setNewItem({ name: '', category: '', price: '', is_available: true, image: null });
    } catch (err) {
      setError(`Failed to add item: ${err.message}`);
    }
  };

  const updateMenuItemImage = async (itemId) => {
    const imageFile = editItemImages[itemId];
    if (!imageFile) {
      setError('No image selected for upload');
      return;
    }
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}_${itemId}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('menu_items')
        .update({ image_url: imageUrl })
        .eq('id', itemId);
      if (updateError) throw updateError;

      setMenuItems(menuItems.map(item =>
        item.id === itemId ? { ...item, image_url: imageUrl } : item
      ));
      setEditItemImages(prev => {
        const newImages = { ...prev };
        delete newImages[itemId];
        return newImages;
      });
    } catch (err) {
      setError(`Failed to update item image: ${err.message}`);
    }
  };

  const toggleAvailability = async (itemId, isAvailable) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !isAvailable })
        .eq('id', itemId);
      if (error) throw error;
      setMenuItems(
        menuItems.map((item) =>
          item.id === itemId ? { ...item, is_available: !isAvailable } : item
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const removeMenuItem = async (itemId) => {
    try {
      const item = menuItems.find(item => item.id === itemId);
      if (item.image_url) {
        const fileName = item.image_url.split('/').pop();
        await supabase.storage.from('menu-images').remove([fileName]);
      }
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

  const fetchHistoryOrders = async () => {
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          item_id,
          quantity,
          note,
          menu_items (name, price)
        )
      `)
      .in('status', historyFilters.statuses)
      .order('created_at', { ascending: false })
      .range(
        (historyFilters.page - 1) * historyFilters.perPage,
        historyFilters.page * historyFilters.perPage - 1
      );

    if (historyFilters.dateRange === 'custom') {
      query = query
        .gte('created_at', format(historyFilters.customStart, 'yyyy-MM-dd'))
        .lte('created_at', format(historyFilters.customEnd, 'yyyy-MM-dd'));
    } else if (historyFilters.dateRange !== 'all') {
      const startDate = new Date();
      if (historyFilters.dateRange === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (historyFilters.dateRange === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (historyFilters.dateRange === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      }
      query = query.gte('created_at', format(startDate, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
    } else {
      setHistoryOrders(data);
    }
  };

  const exportData = async () => {
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          item_id,
          quantity,
          note,
          menu_items (name, price)
        )
      `)
      .in('status', exportFilters.statuses)
      .gte('created_at', format(exportFilters.startDate, 'yyyy-MM-dd'))
      .lte('created_at', format(exportFilters.endDate, 'yyyy-MM-dd'));

    const { data, error } = await query;
    if (error) {
      setError(error.message);
      return;
    }

    if (exportType === 'order') {
      const csv = [
        ['Order ID', 'Table', 'Total', 'Status', 'Created At', 'Items'],
        ...data.map((order) => [
          order.id,
          order.table_id,
          order.total,
          order.status,
          order.created_at,
          order.order_items
            .map((item) => `${item.menu_items.name} x${item.quantity}`)
            .join('; '),
        ]),
      ]
        .map((row) => row.join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orders.csv';
      a.click();
    } else {
      const itemsMap = {};
      data.forEach((order) => {
        order.order_items.forEach((item) => {
          const name = item.menu_items.name;
          if (!itemsMap[name]) {
            itemsMap[name] = 0;
          }
          itemsMap[name] += item.quantity;
        });
      });

      const csv = [
        ['Item Name', 'Total Quantity'],
        ...Object.entries(itemsMap).map(([name, quantity]) => [name, quantity]),
      ]
        .map((row) => row.join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'items.csv';
      a.click();
    }
  };

  const handlePayment = async () => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'paid', payment_type: paymentType })
        .eq('id', selectedOrderId);
      if (error) throw error;
      setShowPaymentModal(false);
      setSelectedOrderId(null);
      setPaymentType('');
      fetchOrders();
      fetchPaidOrders();
      fetchRevenue();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border p-2 rounded-lg w-full"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border p-2 rounded-lg w-full"
                required
              />
            </div>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <div className="w-64 bg-white shadow-md">
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-800">Admin Panel</h2>
        </div>
        <nav className="mt-4">
          {[
            { name: 'Pending Orders', icon: ClockIcon },
            { name: 'Paid Orders', icon: CheckCircleIcon },
            { name: 'Revenue', icon: ChartBarIcon },
            { name: 'Menu Management', icon: ClipboardDocumentListIcon },
            { name: 'Order History', icon: PrinterIcon },
          ].map((item) => (
            <button
              key={item.name}
              className={`w-full flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 ${
                activeTab === item.name ? 'bg-gray-100 font-semibold' : ''
              }`}
              onClick={() => setActiveTab(item.name)}
            >
              <item.icon className="h-5 w-5 mr-2" />
              {item.name}
            </button>
          ))}
          <button
            className="w-full flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100"
            onClick={handleLogout}
          >
            <span className="h-5 w-5 mr-2">🚪</span>
            Logout
          </button>
        </nav>
      </div>
      <div className="flex-1 p-8">
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">{error}</div>
        )}

        {activeTab === 'Pending Orders' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Pending Orders</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500">No pending orders.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Order #{order.id}</h3>
                      <span
                        className={`text-sm px-2 py-1 rounded ${
                          order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : order.status === 'accepted'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'in_progress'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {order.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Table: {order.table_id}</p>
                    <p className="text-sm text-gray-500 mb-2">
                      Total: ₹{order.total.toFixed(2)}
                    </p>
                    <ul className="text-sm mb-4">
                      {order.order_items.map((item) => (
                        <li key={item.id}>
                          {item.menu_items.name} x{item.quantity}
                          {item.note && <span className="text-gray-500"> ({item.note})</span>}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                          onClick={() => updateOrderStatus(order.id, 'accepted')}
                        >
                          Accept
                        </button>
                      )}
                      {order.status === 'accepted' && (
                        <button
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                          onClick={() => updateOrderStatus(order.id, 'in_progress')}
                        >
                          Start Preparing
                        </button>
                      )}
                      {order.status === 'in_progress' && (
                        <button
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                        >
                          Mark Ready
                        </button>
                      )}
                      <button
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                        onClick={() => editOrder(order)}
                      >
                        <PencilSquareIcon className="h-5 w-5 inline" />
                      </button>
                      <button
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setShowPaymentModal(true);
                        }}
                      >
                        Mark Paid
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Paid Orders' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Paid Orders</h2>
            {paidOrders.length === 0 ? (
              <p className="text-gray-500">No paid orders.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paidOrders.map((order) => (
                  <div key={order.id} className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Order #{order.id}</h3>
                      <span className="text-sm px-2 py-1 rounded bg-green-100 text-green-700">
                        PAID
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Table: {order.table_id}</p>
                    <p className="text-sm text-gray-500 mb-2">
                      Total: ₹{order.total.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      Payment Type: {order.payment_type || 'N/A'}
                    </p>
                    <ul className="text-sm mb-4">
                      {order.order_items.map((item) => (
                        <li key={item.id}>
                          {item.menu_items.name} x{item.quantity}
                          {item.note && <span className="text-gray-500"> ({item.note})</span>}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      onClick={() => setViewingOrder(order)}
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Revenue' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Revenue</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">Weekly Revenue</h3>
                <p className="text-2xl font-bold text-green-600">
                  ₹{weeklyRevenue.toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">Monthly Revenue</h3>
                <p className="text-2xl font-bold text-green-600">
                  ₹{monthlyRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Menu Management' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Menu Management</h2>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">Add New Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="border p-2 rounded-lg w-full"
                    aria-label="Item name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="border p-2 rounded-lg w-full"
                    aria-label="Item category"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price</label>
                  <input
                    type="number"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="border p-2 rounded-lg w-full"
                    aria-label="Item price"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Image (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewItem({ ...newItem, image: e.target.files[0] })}
                    className="border p-2 rounded-lg w-full"
                    aria-label="Upload item image"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newItem.is_available}
                      onChange={(e) => setNewItem({ ...newItem, is_available: e.target.checked })}
                      className="mr-2"
                      aria-label="Item availability"
                    />
                    Available
                  </label>
                </div>
              </div>
              <button
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                onClick={addMenuItem}
                aria-label="Add menu item"
              >
                Add Item
              </button>
            </div>
            <h3 className="text-lg font-semibold mb-4">Menu Items</h3>
            <table className="w-full bg-white rounded-lg shadow-md">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-right py-3 px-4">Price</th>
                  <th className="text-center py-3 px-4">Available</th>
                  <th className="text-center py-3 px-4">Image</th>
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
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-10 w-10 object-cover rounded mx-auto"
                        />
                      ) : (
                        <span>-</span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setEditItemImages({ ...editItemImages, [item.id]: e.target.files[0] })}
                        className="mt-2"
                        aria-label={`Upload image for ${item.name}`}
                      />
                      {editItemImages[item.id] && (
                        <button
                          className="mt-2 text-blue-600 hover:text-blue-800"
                          onClick={() => updateMenuItemImage(item.id)}
                          aria-label={`Save image for ${item.name}`}
                        >
                          Save Image
                        </button>
                      )}
                    </td>
                    <td className="text-center py-3 px-4 flex gap-2 justify-center">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => toggleAvailability(item.id, item.is_available)}
                        aria-label={`Toggle availability for ${item.name}`}
                      >
                        {item.is_available ? 'Disable' : 'Enable'}
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

        {activeTab === 'Order History' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Order History</h2>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date Range</label>
                  <select
                    value={historyFilters.dateRange}
                    onChange={(e) =>
                      setHistoryFilters({ ...historyFilters, dateRange: e.target.value })
                    }
                    className="border p-2 rounded-lg w-full"
                  >
                    <option value="today">Today</option>
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                    <option value="custom">Custom</option>
                    <option value="all">All</option>
                  </select>
                </div>
                {historyFilters.dateRange === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Date</label>
                      <DatePicker
                        selected={historyFilters.customStart}
                        onChange={(date) =>
                          setHistoryFilters({ ...historyFilters, customStart: date })
                        }
                        className="border p-2 rounded-lg w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">End Date</label>
                      <DatePicker
                        selected={historyFilters.customEnd}
                        onChange={(date) =>
                          setHistoryFilters({ ...historyFilters, customEnd: date })
                        }
                        className="border p-2 rounded-lg w-full"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Statuses</label>
                  <select
                    multiple
                    value={historyFilters.statuses}
                    onChange={(e) =>
                      setHistoryFilters({
                        ...historyFilters,
                        statuses: Array.from(e.target.selectedOptions, (option) => option.value),
                      })
                    }
                    className="border p-2 rounded-lg w-full"
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="ready">Ready</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <button
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                onClick={fetchHistoryOrders}
              >
                Apply Filters
              </button>
            </div>
            <h3 className="text-lg font-semibold mb-4">Orders</h3>
            <table className="w-full bg-white rounded-lg shadow-md">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Order ID</th>
                  <th className="text-left py-3 px-4">Table</th>
                  <th className="text-right py-3 px-4">Total</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyOrders.map((order) => (
                  <tr key={order.id} className="border-b">
                    <td className="py-3 px-4">{order.id}</td>
                    <td className="py-3 px-4">{order.table_id}</td>
                    <td className="text-right py-3 px-4">₹{order.total.toFixed(2)}</td>
                    <td className="text-center py-3 px-4">
                      <span
                        className={`text-sm px-2 py-1 rounded ${
                          order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : order.status === 'accepted'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'in_progress'
                            ? 'bg-orange-100 text-orange-700'
                            : order.status === 'ready'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {order.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => setViewingOrder(order)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-between">
              <button
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                onClick={() =>
                  setHistoryFilters({
                    ...historyFilters,
                    page: Math.max(historyFilters.page - 1, 1),
                  })
                }
                disabled={historyFilters.page === 1}
              >
                Previous
              </button>
              <button
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                onClick={() =>
                  setHistoryFilters({ ...historyFilters, page: historyFilters.page + 1 })
                }
              >
                Next
              </button>
            </div>
          </div>
        )}

        {editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-lg">
              <h3 className="text-lg font-semibold mb-4">Edit Order #{editingOrder.id}</h3>
              <ul className="mb-4">
                {editedItems.map((item, index) => (
                  <li key={item.id} className="mb-2">
                    <div className="flex justify-between">
                      <span>
                        {item.name} x
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            setEditedItems(
                              editedItems.map((i, idx) =>
                                idx === index ? { ...i, quantity: parseInt(e.target.value) } : i
                              )
                            )
                          }
                          className="border p-1 rounded-lg w-16 mx-2"
                        />
                      </span>
                      <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Note"
                      value={item.note}
                      onChange={(e) =>
                        setEditedItems(
                          editedItems.map((i, idx) =>
                            idx === index ? { ...i, note: e.target.value } : i
                          )
                        )
                      }
                      className="border p-1 rounded-lg w-full mt-1"
                    />
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  onClick={saveEditedOrder}
                >
                  Save
                </button>
                <button
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  onClick={() => setEditingOrder(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {viewingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-lg">
              <h3 className="text-lg font-semibold mb-4">Order #{viewingOrder.id}</h3>
              <p className="text-sm text-gray-500 mb-2">Table: {viewingOrder.table_id}</p>
              <p className="text-sm text-gray-500 mb-2">
                Total: ₹{viewingOrder.total.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mb-2">
                Status: {viewingOrder.status.replace('_', ' ').toUpperCase()}
              </p>
              <p className="text-sm text-gray-500 mb-2">
                Payment Type: {viewingOrder.payment_type || 'N/A'}
              </p>
              <ul className="text-sm mb-4">
                {viewingOrder.order_items.map((item) => (
                  <li key={item.id}>
                    {item.menu_items.name} x{item.quantity}
                    {item.note && <span className="text-gray-500"> ({item.note})</span>}
                  </li>
                ))}
              </ul>
              <button
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                onClick={() => setViewingOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Mark Order as Paid</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Payment Type</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="border p-2 rounded-lg w-full"
                >
                  <option value="">Select Payment Type</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  onClick={handlePayment}
                  disabled={!paymentType}
                >
                  Confirm
                </button>
                <button
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Order History' && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Export Data</h3>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Export Type</label>
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                    className="border p-2 rounded-lg w-full"
                  >
                    <option value="order">Order Data</option>
                    <option value="item">Item Data</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <DatePicker
                    selected={exportFilters.startDate}
                    onChange={(date) =>
                      setExportFilters({ ...exportFilters, startDate: date })
                    }
                    className="border p-2 rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <DatePicker
                    selected={exportFilters.endDate}
                    onChange={(date) =>
                      setExportFilters({ ...exportFilters, endDate: date })
                    }
                    className="border p-2 rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Statuses</label>
                  <select
                    multiple
                    value={exportFilters.statuses}
                    onChange={(e) =>
                      setExportFilters({
                        ...exportFilters,
                        statuses: Array.from(e.target.selectedOptions, (option) => option.value),
                      })
                    }
                    className="border p-2 rounded-lg w-full"
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="ready">Ready</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <button
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                onClick={exportData}
              >
                Export
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}