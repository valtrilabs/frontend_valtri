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

  const formatToISTDateForComparison = (date) => {
    const utcDate = new Date(date);
    const istDate = add(utcDate, { hours: 5, minutes: 30 });
    return format(istDate, 'yyyy-MM-dd');
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
            setOrders(prevOrders => [...prevOrders, orderDetails]);
          } catch (err) {
            setError(`Failed to fetch new order: ${err.message}`);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const updatedOrder = payload.new;
        if (updatedOrder.status !== 'pending') {
          setOrders(prevOrders => prevOrders.filter(order => order.id !== updatedOrder.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [isLoggedIn, activeTab]);

  useEffect(() => {
    async function fetchPaidOrders() {
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
        setPaidOrders(data);
      } catch (err) {
        setError(`Failed to fetch paid orders: ${err.message}`);
      }
    }
    if (isLoggedIn && activeTab === 'Data Analytics') fetchPaidOrders();
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
    if (isLoggedIn) fetchMenu();
  }, [isLoggedIn]);

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
          break;
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
      setOrders(orders.filter(order => order.id !== selectedOrderId));
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
    const newItems = [...editedItems];
    const newQuantity = Math.max(1, (newItems[index].quantity || 1) + delta);
    newItems[index] = { ...newItems[index], quantity: newQuantity };
    setEditedItems(newItems);
  };

  const removeItem = (index) => {
    setEditedItems(editedItems.filter((_, i) => i !== index));
  };

  const addItem = (itemId) => {
    const menuItem = menuItems.find(item => item.id === itemId);
    if (menuItem && !editedItems.some(item => item.item_id === itemId)) {
      setEditedItems([...editedItems, {
        item_id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
      }]);
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
      setOrders(orders.map(o => o.id === editingOrder.id ? updatedOrder : o));
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
      let imageUrl = null;
      if (newItem.image) {
        const fileName = `${Date.now()}_${newItem.image.name}`;
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, newItem.image);
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
          image_url: imageUrl,
        }])
        .select();
      if (error) throw error;
      setMenuItems([...menuItems, data[0]]);
      setNewItem({ name: '', category: '', price: '', is_available: true, image: null });
    } catch (err) {
      setError(`Failed to add item: ${err.message}`);
    }
  };

  const removeMenuItem = async (itemId) => {
    try {
      const item = menuItems.find(item => item.id === itemId);
      if (item?.image_url) {
        const fileName = item.image_url.split('/').pop();
        const { error: storageError } = await supabase.storage
          .from('menu-images')
          .remove([fileName]);
        if (storageError) throw storageError;
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

  const printBill = (order) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      setError('Failed to open print window. Please allow pop-ups for this site.');
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
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              font-size: 14px;
              line-height: 1.4;
              color: #000;
            }
            .receipt {
              width: 300px;
              padding: 10px;
              margin: 0 auto;
              background: #fff;
            }
            .header {
              text-align: center;
              margin-bottom: 10px;
            }
            .header h1 {
              font-size: 20px;
              font-weight: bold;
              margin: 0;
            }
            .header p {
              margin: 5px 0;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 5px 0;
            }
            th {
              text-align: left;
            }
            th.right, td.right {
              text-align: right;
            }
            .total {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              margin-top: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 10px;
            }
            @media print {
              body * {
                visibility: hidden;
              }
              .receipt, .receipt * {
                visibility: visible;
              }
              .receipt {
                position: absolute;
                left: 0;
                top: 0;
                width: 300px;
                margin: 0;
                padding: 10px;
              }
              @page {
                size: 80mm auto;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>Gsaheb Cafe</h1>
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
                  <th class="right">Qty</th>
                  <th class="right">Price</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => `
                  <tr>
                    <td style="max-width: 180px; word-break: break-word;">${item.name}</td>
                    <td class="right">${item.quantity || 1}</td>
                    <td class="right">₹${(item.price * (item.quantity || 1)).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="divider"></div>
            <div class="total">
              <span>Total</span>
              <span>₹${total.toFixed(2)}</span>
            </div>
            <div class="footer">
              <p>Thank you for dining with us!</p>
            </div>
          </div>
          <script>
            try {
              window.onload = () => {
                window.print();
                window.onafterprint = () => window.close();
              };
            } catch (err) {
              console.error('Print error:', err);
            }
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const getAnalytics = () => {
    const today = formatToISTDateForComparison(new Date());
    const todaysOrders = paidOrders.filter(order =>
      formatToISTDateForComparison(new Date(order.created_at)) === today
    );
    const totalOrders = todaysOrders.length;
    const totalRevenue = todaysOrders.reduce((sum, order) =>
      sum + order.items.reduce((s, item) => s + (item.price * (item.quantity || 1)), 0), 0
    );
    const itemCounts = {};
    todaysOrders.forEach(order => {
      order.items.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
      });
    });
    const mostSoldItem = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])[0] || ['None', 0];
    const ordersByHour = Array(24).fill(0);
    todaysOrders.forEach(order => {
      const hour = parseInt(formatToISTHourOnly(new Date(order.created_at)));
      ordersByHour[hour]++;
    });
    const peakHour = ordersByHour.indexOf(Math.max(...ordersByHour));
    const totalItemsSold = todaysOrders.reduce((sum, order) =>
      sum + order.items.reduce((s, item) => s + (item.quantity || 1), 0), 0
    );
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalOrders, totalRevenue, mostSoldItem, peakHour, totalItemsSold, aov };
  };

  const analytics = getAnalytics();

  const exportOrders = () => {
    const startDate = new Date(exportFilters.startDate.setHours(0, 0, 0, 0)).toISOString();
    const endDate = new Date(exportFilters.endDate.setHours(23, 59, 59, 999)).toISOString();
    const filteredOrders = historyOrders.filter(order => {
      const orderDate = new Date(order.created_at).toISOString();
      const matchesDate = orderDate >= startDate && orderDate <= endDate;
      const matchesStatus = exportFilters.statuses.length ? exportFilters.statuses.includes(order.status) : true;
      return matchesDate && matchesStatus;
    });
    let csv;
    if (exportType === 'order') {
      csv = [
        'Order ID,Date,Time,Table Number,Status,Total Amount,Items,Payment Method',
        ...filteredOrders.map(order => {
          const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
          const date = formatToISTDateOnly(new Date(order.created_at));
          const time = formatToIST(new Date(order.created_at)).split(' ')[1];
          const items = order.items.map(item => `${item.name} x${item.quantity || 1}`).join(', ');
          return `${order.order_number || order.id},${date},${time},${order.tables?.number || order.table_id},${order.status},${total.toFixed(2)},${items},${order.payment_type || 'N/A'}`;
        }),
      ];
    } else {
      csv = [
        'Order ID,Date,Item Name,Quantity,Unit Price,Total Price,Status,Table Number,Payment Method',
        ...filteredOrders.flatMap(order => {
          const date = formatToISTDateOnly(new Date(order.created_at));
          return order.items.map(item => {
            const totalPrice = (item.price * (item.quantity || 1)).toFixed(2);
            return `${order.order_number || order.id},${date},${item.name},${item.quantity || 1},${item.price.toFixed(2)},${totalPrice},${order.status},${order.tables?.number || order.table_id},${order.payment_type || 'N/A'}`;
          });
        }),
      ];
    }
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${exportType}_${formatToISTDateOnly(new Date())}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const StatusFilter = ({ statuses, onChange, label }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="border rounded-lg p-3 bg-gray-50">
        {['pending', 'paid'].map(status => (
          <label key={status} className="flex items-center mb-2">
            <input
              type="checkbox"
              value={status}
              checked={statuses.includes(status)}
              onChange={(e) => {
                const newStatuses = e.target.checked
                  ? [...statuses, status]
                  : statuses.filter(s => s !== status);
                onChange(newStatuses);
              }}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label={`Filter by ${status} status`}
            />
            <span className={`capitalize ${status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
              {status}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

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
      <div className="w-64 bg-white shadow-lg p-4 fixed h-full">
        <h1 className="text-2xl font-bold mb-8 text-gray-800">Gsaheb Cafe Admin</h1>
        <nav>
          {['Pending Orders', 'Order History', 'Menu Management', 'Data Analytics'].map(tab => (
            <button
              key={tab}
              className={`w-full text-left py-3 px-4 mb-2 rounded-lg flex items-center gap-2 ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
            >
              {tab === 'Pending Orders' && <ClipboardDocumentListIcon className="h-5 w-5" />}
              {tab === 'Order History' && <ClockIcon className="h-5 w-5" />}
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

      <div className="ml-64 flex-1 p-8">
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6" role="alert">
            {error}
          </div>
        )}

        {activeTab === 'Pending Orders' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Pending Orders</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center">No pending orders</p>
            ) : (
              <div className="grid gap-6">
                {orders.map(order => {
                  const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
                  const formattedDate = formatToIST(new Date(order.created_at));
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
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            onClick={() => startEditing(order)}
                            aria-label={`Edit order ${order.order_number || order.id}`}
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                            Edit
                          </button>
                          <button
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                            onClick={() => initiateMarkAsPaid(order.id)}
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

        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Select Payment Method</h3>
              <select
                className="border p-2 w-full rounded-lg mb-4"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                aria-label="Select payment method"
              >
                <option value="">Select Payment Method</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="Card">Card</option>
              </select>
              <div className="flex justify-end gap-2">
                <button
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedOrderId(null);
                    setPaymentType('');
                  }}
                  aria-label="Cancel payment selection"
                >
                  Cancel
                </button>
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  onClick={markAsPaid}
                  aria-label="Confirm payment"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full">
              <h3 className="text-xl font-bold mb-4">Edit Order #{editingOrder.order_number || editingOrder.id}</h3>
              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-center py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editedItems.map((item, index) => (
                    <tr key={index}>
                      <td className="py-2">{item.name}</td>
                      <td className="text-right py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="bg-gray-200 px-2 py-1 rounded"
                            onClick={() => updateQuantity(index, -1)}
                            aria-label={`Decrease quantity for ${item.name}`}
                          >
                            -
                          </button>
                          <span>{item.quantity || 1}</span>
                          <button
                            className="bg-gray-200 px-2 py-1 rounded"
                            onClick={() => updateQuantity(index, 1)}
                            aria-label={`Increase quantity for ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="text-right py-2">₹{(item.price * (item.quantity || 1)).toFixed(2)}</td>
                      <td className="text-center py-2">
                        <button
                          className="text-red-600 hover:text-red-800"
                          onClick={() => removeItem(index)}
                          aria-label={`Remove ${item.name}`}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Add Item</label>
                <select
                  className="border p-2 w-full rounded-lg"
                  onChange={(e) => addItem(Number(e.target.value))}
                  value=""
                  aria-label="Add item to order"
                >
                  <option value="">Select item</option>
                  {menuItems.filter(item => item.is_available).map(item => (
                    <option key={item.id} value={item.id}>{item.name} (₹{item.price.toFixed(2)})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                  onClick={cancelEdit}
                  aria-label="Cancel edit"
                >
                  Cancel
                </button>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  onClick={saveOrder}
                  aria-label="Save order changes"
                >
                  Update Order
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Order History' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Order History</h2>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date Range</label>
                  <select
                    className="border p-2 w-full rounded-lg"
                    value={historyFilters.dateRange}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, dateRange: e.target.value, page: 1 })}
                    aria-label="Date range filter"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7days">Last 7 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  {historyFilters.dateRange === 'custom' && (
                    <div className="mt-2 flex gap-2">
                      <DatePicker
                        selected={historyFilters.customStart}
                        onChange={date => setHistoryFilters({ ...historyFilters, customStart: date, page: 1 })}
                        className="border p-2 rounded-lg w-full"
                        aria-label="Custom start date"
                      />
                      <DatePicker
                        selected={historyFilters.customEnd}
                        onChange={date => setHistoryFilters({ ...historyFilters, customEnd: date, page: 1 })}
                        className="border p-2 rounded-lg w-full"
                        aria-label="Custom end date"
                      />
                    </div>
                  )}
                </div>
                <StatusFilter
                  label="Status"
                  statuses={historyFilters.statuses}
                  onChange={(newStatuses) => setHistoryFilters({ ...historyFilters, statuses: newStatuses, page: 1 })}
                />
              </div>
            </div>
            {historyOrders.length === 0 ? (
              <p className="text-gray-500 text-center">No orders found</p>
            ) : (
              <>
                <table className="w-full bg-white rounded-lg shadow-md">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Order ID</th>
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Table</th>
                      <th className="text-right py-3 px-4">Total</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Payment Method</th>
                      <th className="text-center py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyOrders.slice(
                      (historyFilters.page - 1) * historyFilters.perPage,
                      historyFilters.page * historyFilters.perPage
                    ).map(order => {
                      const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
                      return (
                        <tr key={order.id} className="border-b">
                          <td className="py-3 px-4">{order.order_number || order.id}</td>
                          <td className="py-3 px-4">{formatToIST(new Date(order.created_at))}</td>
                          <td className="py-3 px-4">{order.tables?.number || order.table_id}</td>
                          <td className="text-right py-3 px-4">₹{total.toFixed(2)}</td>
                          <td className="py-3 px-4">{order.status}</td>
                          <td className="py-3 px-4">{order.payment_type || 'N/A'}</td>
                          <td className="text-center py-3 px-4 flex gap-2 justify-center">
                            <button
                              className="text-blue-600 hover:text-blue-800"
                              onClick={() => setViewingOrder(order)}
                              aria-label={`View invoice for order ${order.order_number || order.id}`}
                            >
                              View
                            </button>
                            <button
                              className="text-gray-600 hover:text-gray-800"
                              onClick={() => printBill(order)}
                              aria-label={`Print invoice for order ${order.order_number || order.id}`}
                            >
                              <PrinterIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex justify-between items-center mt-4">
                  <button
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    onClick={() => setHistoryFilters({ ...historyFilters, page: historyFilters.page - 1 })}
                    disabled={historyFilters.page === 1}
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <span>Page {historyFilters.page} of {Math.ceil(historyOrders.length / historyFilters.perPage)}</span>
                  <button
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    onClick={() => setHistoryFilters({ ...historyFilters, page: historyFilters.page + 1 })}
                    disabled={historyFilters.page * historyFilters.perPage >= historyOrders.length}
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {viewingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full">
              <h3 className="text-xl font-bold mb-4">Invoice #{viewingOrder.order_number || viewingOrder.id}</h3>
              <p className="text-sm text-gray-500 mb-2">{formatToIST(new Date(viewingOrder.created_at))}</p>
              <p className="text-sm text-gray-500 mb-2">Table {viewingOrder.tables?.number || viewingOrder.table_id}</p>
              <p className="text-sm text-gray-500 mb-4">Payment Method: {viewingOrder.payment_type || 'N/A'}</p>
              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingOrder.items.map((item, index) => (
                    <tr key={index}>
                      <td className="py-2">{item.name}</td>
                      <td className="text-right py-2">{item.quantity || 1}</td>
                      <td className="text-right py-2">₹{(item.price * (item.quantity || 1)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between font-semibold mb-4">
                <span>Total</span>
                <span>₹{viewingOrder.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                  onClick={() => setViewingOrder(null)}
                  aria-label="Close invoice"
                >
                  Close
                </button>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  onClick={() => printBill(viewingOrder)}
                  aria-label={`Print invoice for ${viewingOrder.order_number || viewingOrder.id}`}
                >
                  <PrinterIcon className="h-5 w-5" />
                  Print
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Menu Management' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Menu Management</h2>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">Add New Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  <label className="block text-sm font-medium mb-1">Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewItem({ ...newItem, image: e.target.files[0] })}
                    className="border p-2 rounded-lg w-full"
                    aria-label="Item image"
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
                          className="h-12 w-12 object-cover rounded-md mx-auto"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1550547660-d9450f859349';
                          }}
                        />
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                              try {
                                const fileName = `${Date.now()}_${file.name}`;
                                const { error: uploadError } = await supabase.storage
                                  .from('menu-images')
                                  .upload(fileName, file);
                                if (uploadError) throw uploadError;
                                const { data: urlData } = supabase.storage
                                  .from('menu-images')
                                  .getPublicUrl(fileName);
                                const imageUrl = urlData.publicUrl;
                                const { error: updateError } = await supabase
                                  .from('menu_items')
                                  .update({ image_url: imageUrl })
                                  .eq('id', item.id);
                                if (updateError) throw updateError;
                                setMenuItems(menuItems.map(i =>
                                  i.id === item.id ? { ...i, image_url: imageUrl } : i
                                ));
                              } catch (err) {
                                setError(`Failed to upload image: ${err.message}`);
                              }
                            }
                          }}
                          className="mx-auto"
                          aria-label={`Upload image for ${item.name}`}
                        />
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

        {activeTab === 'Data Analytics' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Total Orders</h3>
                <p className="text-2xl font-bold">{analytics.totalOrders}</p>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Total Revenue</h3>
                <p className="text-2xl font-bold">₹{analytics.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Most Sold Item</h3>
                <p className="text-2xl font-bold">{analytics.mostSoldItem[0]}</p>
                <p className="text-sm">{analytics.mostSoldItem[1]} units</p>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Peak Hour</h3>
                <p className="text-2xl font-bold">
                  {analytics.peakHour === -1 ? 'N/A' : `${analytics.peakHour}:00`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Weekly Revenue</h3>
                <p className="text-2xl font-bold">₹{weeklyRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Monthly Revenue</h3>
                <p className="text-2xl font-bold">₹{monthlyRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Average Order Value</h3>
                <p className="text-2xl font-bold">₹{analytics.aov.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Total Items Sold</h3>
                <p className="text-2xl font-bold">{analytics.totalItemsSold}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Export Orders</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Export Type</label>
                  <select
                    className="border p-2 rounded-lg w-full"
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                    aria-label="Select export type"
                  >
                    <option value="order">Order Summary</option>
                    <option value="items">Itemized</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <DatePicker
                    selected={exportFilters.startDate}
                    onChange={(date) => setExportFilters({ ...exportFilters, startDate: date })}
                    className="border p-2 rounded-lg w-full"
                    aria-label="Start date picker for export"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <DatePicker
                    selected={exportFilters.endDate}
                    onChange={(date) => setExportFilters({ ...exportFilters, endDate: date })}
                    className="border p-2 rounded-lg w-full"
                    aria-label="End date picker for export"
                  />
                </div>
              </div>
              <div className="mt-4">
                <StatusFilter
                  label="Status"
                  statuses={exportFilters.statuses}
                  onChange={(newStatuses) => setExportFilters({ ...exportFilters, statuses: newStatuses })}
                />
              </div>
              <button
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                onClick={exportOrders}
                aria-label="Export orders"
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