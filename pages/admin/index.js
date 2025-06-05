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
  const [newItem, setNewItem] = useState({ name: '', category: '', price: '', is_available: true });
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
  const [isLoadingPaidOrders, setIsLoadingPaidOrders] = useState(false);

  // Utility functions for date formatting
  const formatToYYYYMMDD = (date) => format(new Date(date), 'yyyy-MM-dd');
  const dateFromString = (str) => new Date(str);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const formatToIST = (date) => {
    const utcDate = new Date(date);
    const istDate = add(utcDate, { hours: 5, minutes: 30 });
    return format(istDate, 'dd/MM/yyyy HH:mm:ss');
  };

  const formatToISTDateOnly = (date) => {
    const utcDate = new Date(date);
    const istDate = add(utcDate, { hours: 5, minutes: 30 });
    return format(istDate, 'dd/MM/yyyy');
  };

  const formatToISTHourOnly = (date) => {
    const utcDate = new Date(date);
    const istDate = add(utcDate, { hours: 5, minutes: 30 });
    return format(istDate, 'HH');
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsLoggedIn(true);
      else router.push('/admin');
    };
    checkSession();
  }, [router]);

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
    if (isLoggedIn && activeTab === 'Pending Orders') fetchOrders();
  }, [isLoggedIn, activeTab]);

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'Pending Orders') return;
    const subscription = supabase
      .channel('pending-orders-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
        const newOrder = payload.new;
        if (newOrder.status === 'pending') {
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
            const response = await fetch(`${apiUrl}/api/orders/${newOrder.id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const orderDetails = await response.json();
            setOrders((prevOrders) => [...prevOrders, orderDetails]);
          } catch (err) {
            setError(`Failed to fetch new order: ${err.message}`);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const updatedOrder = payload.new;
        if (updatedOrder.status !== 'pending') {
          setOrders((prevOrders) => prevOrders.filter((order) => order.id !== updatedOrder.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [isLoggedIn, activeTab]);

  useEffect(() => {
    async function fetchPaidOrdersWithRetry(maxRetries = 3, delayMs = 1000) {
      setIsLoadingPaidOrders(true);
      let retries = 0;

      while (retries < maxRetries) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          const params = new URLSearchParams({
            startDate: todayStart.toISOString(),
            endDate: todayEnd.toISOString(),
            statuses: 'paid',
          });
          const response = await fetch(`${apiUrl}/api/admin/orders/history?${params}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          console.log('fetchPaidOrders: Fetched data', data);
          setPaidOrders((prev) => data.length > 0 ? data : prev);
          setIsLoadingPaidOrders(false);
          return;
        } catch (err) {
          retries++;
          console.error(`fetchPaidOrders: Attempt ${retries} failed`, err.message);
          if (retries === maxRetries) {
            setError(`Failed to fetch paid orders after ${maxRetries} attempts: ${err.message}`);
            setIsLoadingPaidOrders(false);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    if (isLoggedIn && activeTab === 'Data Analytics') {
      fetchPaidOrdersWithRetry();
    }
  }, [isLoggedIn, activeTab]);

  useEffect(() => {
    async function fetchRevenueData() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
        const now = new Date();

        // Weekly Revenue (last 7 days)
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(now);
        weekEnd.setHours(23, 59, 59, 999);
        const weekParams = new URLSearchParams({
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
          statuses: 'paid',
          aggregate: 'revenue',
        });
        const weekResponse = await fetch(`${apiUrl}/api/admin/orders/history?${weekParams}`);
        if (!weekResponse.ok) throw new Error(`HTTP ${weekResponse.status}`);
        const weekData = await weekResponse.json();
        setWeeklyRevenue(weekData.totalRevenue || 0);

        // Monthly Revenue (last 30 days)
        const monthStart = new Date(now);
        monthStart.setDate(now.getDate() - 30);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(now);
        monthEnd.setHours(23, 59, 59, 999);
        const monthParams = new URLSearchParams({
          startDate: monthStart.toISOString(),
          endDate: monthEnd.toISOString(),
          statuses: 'paid',
          aggregate: 'revenue',
        });
        const monthResponse = await fetch(`${apiUrl}/api/admin/orders/history?${monthParams}`);
        if (!monthResponse.ok) throw new Error(`HTTP ${monthResponse.status}`);
        const monthData = await monthResponse.json();
        setMonthlyRevenue(monthData.totalRevenue || 0);
      } catch (err) {
        setError(`Failed to fetch revenue data: ${err.message}`);
      }
    }
    if (isLoggedIn && activeTab === 'Data Analytics') fetchRevenueData();
  }, [isLoggedIn, activeTab]);

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
    if (isLoggedIn && activeTab === 'Menu Management') fetchMenu();
  }, [isLoggedIn, activeTab]);

  const fetchHistory = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      let startDate, endDate;
      const today = new Date();
      switch (historyFilters.dateRange) {
        case 'today':
          startDate = new Date(today.setHours(0, 0, 0, 0)).toISOString();
          endDate = new Date(today.setHours(23, 59, 59, 999)).toISOString();
          break;
        case 'yesterday':
          startDate = new Date(today.setDate(today.getDate() - 1));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(today.setDate(today.getDate()));
          endDate.setHours(23, 59, 59, 999);
          startDate = startDate.toISOString();
          endDate = endDate.toISOString();
          break;
        case 'last7days':
          startDate = new Date(today.setDate(today.getDate() - 7));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          startDate = startDate.toISOString();
          endDate = endDate.toISOString();
          break;
        case 'custom':
          startDate = new Date(historyFilters.customStart.setHours(0, 0, 0, 0)).toISOString();
          endDate = new Date(historyFilters.customEnd.setHours(23, 59, 59, 999)).toISOString();
          break;
        default:
          return;
      }
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }
      if (historyFilters.statuses.length) {
        params.append('statuses', historyFilters.statuses.join(','));
      }
      const response = await fetch(`${apiUrl}/api/admin/orders/history?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setHistoryOrders(data);
    } catch (err) {
      setError(`Failed to fetch order history: ${err.message}`);
    }
  };

  useEffect(() => {
    if (isLoggedIn && activeTab === 'Order History') fetchHistory();
  }, [isLoggedIn, activeTab, historyFilters.dateRange, historyFilters.statuses, historyFilters.customStart, historyFilters.customEnd]);

  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setIsLoggedIn(true);
    } catch (err) {
      setError(`Login failed: ${err.message}`);
    }
  };

  const initiateMarkAsPaid = (orderId) => {
    setSelectedOrderId(orderId);
    setPaymentType('');
    setShowPaymentModal(true);
  };

  const markAsPaid = async () => {
    if (!paymentType) {
      setError('Please select a payment method');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/api/orders/${selectedOrderId}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_type: paymentType }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setOrders((prevOrders) => prevOrders.filter((order) => order.id !== selectedOrderId));
      // Refresh paid orders
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const params = new URLSearchParams({
        startDate: todayStart.toISOString(),
        endDate: todayEnd.toISOString(),
        statuses: 'paid',
      });
      const paidResponse = await fetch(`${apiUrl}/api/admin/orders/history?${params}`);
      if (paidResponse.ok) {
        const paidData = await paidResponse.json();
        setPaidOrders(paidData);
      }
      setShowPaymentModal(false);
      setSelectedOrderId(null);
      setPaymentType('');
    } catch (err) {
      setError(`Failed to mark order as paid: ${err.message}`);
    }
  };

  const startEditing = (order) => {
    setEditingOrder(order);
    setEditedItems([...order.items]);
  };

  const updateQuantity = (index, delta) => {
    setEditedItems((prevItems) => {
      const newItems = [...prevItems];
      const newQuantity = Math.max(1, (newItems[index].quantity || 1) + delta);
      newItems[index] = { ...newItems[index], quantity: newQuantity };
      return newItems;
    });
  };

  const removeItem = (index) => {
    setEditedItems((prevItems) => prevItems.filter((_, i) => i !== index));
  };

  const addItem = (itemId) => {
    const menuItem = menuItems.find((item) => item.id === parseInt(itemId));
    if (menuItem && !editedItems.some((item) => item.item_id === menuItem.id)) {
      setEditedItems((prevItems) => [
        ...prevItems,
        {
          item_id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
        },
      ]);
    }
  };

  const saveOrder = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/api/orders/${editingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: editedItems }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const updatedOrder = await response.json();
      setOrders((prevOrders) =>
        prevOrders.map((o) => (o.id === editingOrder.id ? updatedOrder : o))
      );
      setEditingOrder(null);
      setEditedItems([]);
    } catch (err) {
      setError(`Failed to update order: ${err.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingOrder(null);
    setEditedItems([]);
  };

  const addMenuItem = async () => {
    if (!newItem.name || !newItem.price) {
      setError('Name and price are required');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .insert([
          {
            name: newItem.name,
            category: newItem.category || '',
            price: parseFloat(newItem.price),
            is_available: newItem.is_available,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      setMenuItems((prevItems) => [...prevItems, data]);
      setNewItem({ name: '', category: '', price: '', is_available: true });
    } catch (err) {
      setError(`Failed to add item: ${err.message}`);
    }
  };

  const removeMenuItem = async (id) => {
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
      setMenuItems((prevItems) => prevItems.filter((item) => item.id !== id));
    } catch (err) {
      setError(`Failed to remove item: ${err.message}`);
    }
  };

  const toggleAvailability = async (id, currentAvailability) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !currentAvailability })
        .eq('id', id)
        .select();
      if (error) throw error;
      setMenuItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id ? { ...item, is_available: !currentAvailability } : item
        )
      );
    } catch (err) {
      setError(`Failed to update availability: ${err.message}`);
    }
  };

  const printBill = (order) => {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      setError('Failed to open print window');
      return;
    }
    const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const formattedDate = formatToIST(new Date(order.created_at));

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - Order #${order.order_number || order.id}</title>
          <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
            .receipt { width: 300px; padding: 20px; margin: 0 auto; background: #fff; }
            .header { text-align: center; margin-bottom: 10px; }
            .header h3 { font-size: 20px; font-weight: bold; margin: 0; }
            .header p { margin: 4px 0; }
            .divider { border-top: 1px dashed #333; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 6px 0; }
            th { text-align: left; font-weight: bold; }
            th.right, td.right-align { text-align: right; }
            .total { display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; }
            .footer { text-align: center; margin-top: 10px; }
            @media print { body { width: 80mm; margin: 0; } .receipt { width: 100%; padding: 10px; margin: 0; } }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h3>Gsaheb Cafe</h3>
              <p>Order #${order.order_number || order.id}</p>
              <p>Table ${order.tables?.number || order.table_id}</p>
              <p>Date: ${formattedDate}</p>
              <p>Payment Method: ${order.payment_type || 'N/A'}</p>
            </div>
            <div class="divider"></div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="right-align">Qty.</th>
                  <th class="right-align">Price</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map((item) => `
                  <tr>
                    <td style="max-width: 150px; word-break: break-word;">${item.name}</td>
                    <td class="right-align">${item.quantity || 1}</td>
                    <td class="right-align">${((item.quantity || 1) * item.price).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="divider"></div>
            <div class="total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div class="footer">
              <p>Thank you for your patronage!</p>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const getAnalytics = () => {
    if (!paidOrders || paidOrders.length === 0) {
      console.log('Analytics: No paid orders data available');
      return {
        totalOrders: 0,
        totalRevenue: 0,
        mostSoldItem: ['No data', 0],
        peakHour: 'N/A',
        totalItemsSold: 0,
        aov: 0,
      };
    }

    const today = formatToISTDateOnly(new Date());
    const data = paidOrders.filter((order) =>
      formatToISTDateOnly(new Date(order.created_at)) === today
    );
    const totalOrders = data.length;
    const totalRevenue = data.reduce(
      (sum, order) => sum + order.items.reduce((s, p) => s + (p.price * (p.quantity || 1)), 0),
      0
    );

    const itemCounts = {};
    data.forEach((order) => {
      order.items.forEach((item) => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
      });
    });

    const mostSoldItem = Object.entries(itemCounts).sort(([, a], [, b]) => b - a)[0] || ['No data', 0];

    const ordersByHour = new Array(24).fill(0);
    data.forEach((order) => {
      const hour = parseInt(formatToISTHourOnly(new Date(order.created_at)));
      ordersByHour[hour]++;
    });

    const peakHour = ordersByHour.indexOf(Math.max(...ordersByHour));
    const totalItemsSold = data.reduce(
      (sum, order) => sum + order.items.reduce((s, p) => s + (p.quantity || 1), 0),
      0
    );

    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return { totalOrders, totalRevenue, mostSoldItem, peakHour: peakHour === -1 ? 'N/A' : `${peakHour}:00`, totalItemsSold, aov };
  };

  const analytics = getAnalytics();

  const exportOrders = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      const startDate = new Date(exportFilters.startDate).toISOString();
      const endDate = new Date(exportFilters.endDate).toISOString();
      const params = new URLSearchParams({
        startDate,
        endDate,
        statuses: exportFilters.statuses.join(','),
      });
      const response = await fetch(`${apiUrl}/api/admin/orders/history?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const filteredData = await response.json();

      let csv = '';
      if (exportType === 'order') {
        csv = [
          'Order No.,Date,Time,Table,Status,Total,Payment Method,Items',
          ...filteredData.map((order) => {
            const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
            const date = formatToISTDateOnly(order.created_at);
            const time = formatToIST(order.created_at).split(' ')[1];
            const items = order.items.map((i) => `${i.name} x${i.quantity || 1}`).join(', ');
            return `"${order.order_number || order.id}","${date}","${time}","${order.tables?.number || order.table_id}","${order.status}","${total.toFixed(2)}","${order.payment_type || ''}","${items}"`;
          }),
        ].join('\n');
      } else {
        csv = [
          'Order No.,Date,Item,Quantity,Price,Total,Status,Table,Payment Method',
          ...filteredData.flatMap((order) => {
            const date = formatToISTDateOnly(order.created_at);
            return order.items.map((item) => {
              const totalPrice = (item.price * (item.quantity || 1)).toFixed(2);
              return `"${order.order_number || order.id}","${date}","${item.name}","${item.quantity || 1}","${item.price.toFixed(2)}","${totalPrice}","${order.status}","${order.tables?.number || order.table_id}","${order.payment_type || ''}"`;
            });
          }),
        ].join('\n');
      }

      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${exportType}-${formatToISTDateOnly(new Date())}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to export orders: ${err.message}`);
    }
  };

  const StatusFilter = ({ statuses, onChange, label }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="border rounded p-2">
        {['pending', 'paid'].map((status) => (
          <label key={status} className="flex items-center mb-1">
            <input
              type="checkbox"
              value={status}
              checked={statuses.includes(status)}
              onChange={(e) => {
                const newStatuses = e.target.checked
                  ? [...statuses, status]
                  : statuses.filter((s) => s !== status);
                onChange(newStatuses);
              }}
              className="mr-2 checkbox"
            />
            <span className={status === 'paid' ? 'text-green-500' : 'text-yellow-500'}>{status}</span>
          </label>
        ))}
      </div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
          <h2 className="text-xl font-bold mb-4">Admin Login</h2>
          {error && <p className="text-red-500 mb-2">{error}</p>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full mb-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input w-full mb-2"
          />
          <button className="btn btn-primary w-full" onClick={handleLogin}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="w-64 bg-white shadow-lg p-4 fixed h-full">
        <h2 className="text-xl font-semibold mb-4">Gsaheb Cafe Admin</h2>
        <nav>
          {['Pending Orders', 'Order History', 'Menu Management', 'Data Analytics'].map((tab) => (
            <button
              key={tab}
              className={`w-full text-left p-2 mb-1 rounded ${activeTab === tab ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        <button
          className="btn btn-danger w-full mt-4"
          onClick={() => supabase.auth.signOut().then(() => setIsLoggedIn(false))}
        >
          Logout
        </button>
      </div>

      <div className="ml-64 p-4 flex-1">
        {error && <div className="alert alert-error mb-4">{error}</div>}

        {activeTab === 'Pending Orders' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Pending Orders</h3>
            {orders.length === 0 ? (
              <p>No pending orders.</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="card shadow mb-2">
                  <div className="card-body">
                    <h4 className="card-title">Order #{order.order_number || order.id}</h4>
                    <p>{formatToIST(order.created_at)}</p>
                    <p>Table #{order.tables?.number || order.table_id}</p>
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name}</td>
                            <td className="text-right">{item.quantity || 1}</td>
                            <td className="text-right">${((item.quantity || 1) * item.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>${order.items.reduce((sum, i) => sum + ((i.quantity || 1) * i.price), 0).toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button className="btn btn-primary" onClick={() => startEditing(order)}>
                        Edit
                      </button>
                      <button className="btn btn-success" onClick={() => initiateMarkAsPaid(order.id)}>
                        Mark as Paid
                      </button>
                      <button className="btn btn-info" onClick={() => printBill(order)}>
                        Print Bill
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {showPaymentModal && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-semibold text-lg">Select Payment Method</h3>
              <select
                className="select w-full mt-2"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
              >
                <option value="">Select Payment Method</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="Card">Card</option>
              </select>
              <div className="modal-action">
                <button
                  className="btn"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedOrderId(null);
                    setPaymentType('');
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-success" onClick={markAsPaid}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {editingOrder && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-semibold text-lg">Edit Order #{editingOrder.order_number || editingOrder.id}</h3>
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {editedItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name}</td>
                      <td className="text-right">
                        <button className="btn btn-sm" onClick={() => updateQuantity(idx, -1)}>
                          -
                        </button>
                        {item.quantity || 1}
                        <button className="btn btn-sm" onClick={() => updateQuantity(idx, 1)}>
                          +
                        </button>
                      </td>
                      <td className="text-right">${((item.quantity || 1) * item.price).toFixed(2)}</td>
                      <td>
                        <button className="btn btn-error btn-sm" onClick={() => removeItem(idx)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <select
                className="select w-full mt-2"
                onChange={(e) => addItem(e.target.value)}
                value=""
              >
                <option value="">Add Item</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (${item.price})
                  </option>
                ))}
              </select>
              <div className="modal-action">
                <button className="btn" onClick={cancelEdit}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={saveOrder}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Order History' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Order History</h3>
            <div className="card shadow-md mb-4 p-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1">Date Range</label>
                  <select
                    className="select w-full"
                    value={historyFilters.dateRange}
                    onChange={(e) => setHistoryFilters((prev) => ({ ...prev, dateRange: e.target.value, page: 1 }))}
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7days">Last 7 Days</option>
                    <option value="custom">Custom</option>
                  </select>
                  {historyFilters.dateRange === 'custom' && (
                    <div className="flex gap-2 mt-2">
                      <DatePicker
                        selected={historyFilters.customStart}
                        onChange={(date) => setHistoryFilters((prev) => ({ ...prev, customStart: date, page: 1 }))}
                        className="input w-full"
                        dateFormat="yyyy-MM-dd"
                      />
                      <DatePicker
                        selected={historyFilters.customEnd}
                        onChange={(date) => setHistoryFilters((prev) => ({ ...prev, customEnd: date, page: 1 }))}
                        className="input w-full"
                        dateFormat="yyyy-MM-dd"
                      />
                    </div>
                  )}
                </div>
                <StatusFilter
                  label="Status"
                  statuses={historyFilters.statuses}
                  onChange={(newStatuses) => setHistoryFilters((prev) => ({ ...prev, statuses: newStatuses, page: 1 }))}
                />
              </div>
            </div>
            {historyOrders.length === 0 ? (
              <p>No orders found</p>
            ) : (
              <>
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Order No.</th>
                      <th>Date</th>
                      <th>Table</th>
                      <th className="text-right">Total</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyOrders
                      .slice((historyFilters.page - 1) * historyFilters.perPage, historyFilters.page * historyFilters.perPage)
                      .map((order) => (
                        <tr key={order.id}>
                          <td>{order.order_number || order.id}</td>
                          <td>{formatToIST(order.created_at)}</td>
                          <td>{order.tables?.number || order.table_id}</td>
                          <td className="text-right">
                            ${order.items.reduce((sum, i) => sum + ((i.quantity || 1) * i.price), 0).toFixed(2)}
                          </td>
                          <td>{order.status}</td>
                          <td>{order.payment_type || 'N/A'}</td>
                          <td>
                            <button className="btn btn-sm" onClick={() => setViewingOrder(order)}>
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="flex justify-between mt-2">
                  <button
                    className="btn"
                    disabled={historyFilters.page === 1}
                    onClick={() => setHistoryFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Previous
                  </button>
                  <span>
                    Page {historyFilters.page} of {Math.ceil(historyOrders.length / historyFilters.perPage)}
                  </span>
                  <button
                    className="btn"
                    disabled={historyFilters.page * historyFilters.perPage >= historyOrders.length}
                    onClick={() => setHistoryFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {viewingOrder && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-semibold text-lg">Order #{viewingOrder.order_number || viewingOrder.id}</h3>
              <p>{formatToIST(viewingOrder.created_at)}</p>
              <p>Table #{viewingOrder.tables?.number || viewingOrder.table_id}</p>
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingOrder.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name}</td>
                      <td className="text-right">{item.quantity || 1}</td>
                      <td className="text-right">${((item.quantity || 1) * item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${viewingOrder.items.reduce((sum, i) => sum + ((i.quantity || 1) * i.price), 0).toFixed(2)}</span>
              </div>
              <div className="modal-action">
                <button className="btn" onClick={() => setViewingOrder(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Menu Management' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Menu Management</h3>
            <div className="card shadow-md mb-4 p-4">
              <h4 className="text-md font-semibold mb-2">Add Item</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={newItem.name}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newItem.category}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={newItem.price}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, price: e.target.value }))}
                  className="input"
                />
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newItem.is_available}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, is_available: e.target.checked }))}
                    className="checkbox mr-2"
                  />
                  Available
                </label>
              </div>
              <button className="btn btn-primary mt-2" onClick={addMenuItem}>
                Add
              </button>
            </div>
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Available?</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menuItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category || '-'}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>{item.is_available ? 'Yes' : 'No'}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => toggleAvailability(item.id, item.is_available)}
                      >
                        Toggle
                      </button>
                      <button className="btn btn-sm btn-error" onClick={() => removeMenuItem(item.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Data Analytics' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Data Analytics</h3>
            {isLoadingPaidOrders ? (
              <p>Loading analytics...</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="card bg-blue-100 p-4">
                    <h4 className="font-semibold">Total Orders</h4>
                    <p>{analytics.totalOrders}</p>
                  </div>
                  <div className="card bg-green-100 p-4">
                    <h4 className="font-semibold">Total Revenue</h4>
                    <p>${analytics.totalRevenue.toFixed(2)}</p>
                  </div>
                  <div className="card bg-purple-100 p-4">
                    <h4 className="font-semibold">Most Sold Item</h4>
                    <p>{analytics.mostSoldItem[0]} ({analytics.mostSoldItem[1]} sold)</p>
                  </div>
                  <div className="card bg-gray-100 p-4">
                    <h4 className="font-semibold">Peak Hour</h4>
                    <p>{analytics.peakHour}</p>
                  </div>
                  <div className="card bg-yellow-100 p-4">
                    <h4 className="font-semibold">Avg. Order Value</h4>
                    <p>${analytics.aov.toFixed(2)}</p>
                  </div>
                  <div className="card bg-orange-100 p-4">
                    <h4 className="font-semibold">Total Items Sold</h4>
                    <p>{analytics.totalItemsSold}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="card bg-teal-100 p-4">
                    <h4 className="font-semibold">Weekly Revenue</h4>
                    <p>${weeklyRevenue.toFixed(2)}</p>
                  </div>
                  <div className="card bg-indigo-100 p-4">
                    <h4 className="font-semibold">Monthly Revenue</h4>
                    <p>${monthlyRevenue.toFixed(2)}</p>
                  </div>
                </div>
                <div className="card shadow-md p-4">
                  <h4 className="text-md font-semibold mb-2">Export Orders</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1">Export Type</label>
                      <select
                        className="select w-full"
                        value={exportType}
                        onChange={(e) => setExportType(e.target.value)}
                      >
                        <option value="order">Order</option>
                        <option value="items">Items</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1">Date Range</label>
                      <DatePicker
                        selected={exportFilters.startDate}
                        onChange={(date) => setExportFilters((prev) => ({ ...prev, startDate: date }))}
                        className="input w-full"
                        dateFormat="yyyy-MM-dd"
                      />
                      <DatePicker
                        selected={exportFilters.endDate}
                        onChange={(date) => setExportFilters((prev) => ({ ...prev, endDate: date }))}
                        className="input w-full mt-1"
                        dateFormat="yyyy-MM-dd"
                      />
                    </div>
                  </div>
                  <StatusFilter
                    label="Status"
                    statuses={exportFilters.statuses}
                    onChange={(newStatuses) => setExportFilters((prev) => ({ ...prev, statuses: newStatuses }))}
                  />
                  <button className="btn btn-primary mt-2" onClick={exportOrders}>
                    Export
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}