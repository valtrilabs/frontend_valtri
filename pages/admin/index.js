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

// Admin dashboard component
export default function Admin() {
  const router = useRouter();
  // State initialization
  const [orders, setOrders] = useState([]);
  const [paidOrders, setPaidOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', category: '', price: '', is_available: true, image: null });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeTab') || 'Pending Orders';
    }
    return 'Pending Orders';
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

  // Save active tab to localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Date formatting functions
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

  // Check auth session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
      } else {
        router.push('/admin');
      }
    };
    checkSession();
  }, [router]);

  // Fetch pending orders
  useEffect(() => {
    async function fetchOrders() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, tables(number), items:order_items(*, menu_items(name, price))')
          .eq('status', 'pending');
        if (error) throw error;
        setOrders(data);
      } catch (err) {
        setError(`Failed to fetch orders: ${err.message}`);
      }
    }
    if (isLoggedIn && activeTab === 'Pending Orders') fetchOrders();
  }, [isLoggedIn, activeTab]);

  // Subscribe to real-time order updates
  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'Pending Orders') return undefined;

    const subscription = supabase
      .channel('pending-orders-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.new.status === 'pending') {
            try {
              const { data, error } = await supabase
                .from('orders')
                .select('*, tables(number), items:order_items(*, menu_items(name, price))')
                .eq('id', payload.new.id)
                .single();
              if (error) throw error;
              setOrders((prev) => [...prev, data]);
            } catch (err) {
              setError(`Failed to fetch new order: ${err.message}`);
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.new.status !== 'pending') {
            setOrders((prev) => prev.filter((order) => order.id !== payload.new.id));
          }
        },
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [isLoggedIn, activeTab]);

  // Fetch paid orders for analytics
  useEffect(() => {
    async function fetchPaidOrders() {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const { data, error } = await supabase
          .from('orders')
          .select('*, tables(number), items:order_items(*, menu_items(name, price))')
          .eq('status', 'paid')
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString());
        if (error) throw error;
        setPaidOrders(data);
      } catch (err) {
        setError(`Failed to fetch paid orders: ${err.message}`);
      }
    }
    if (isLoggedIn && activeTab === 'Data Analytics') fetchPaidOrders();
  }, [isLoggedIn, activeTab]);

  // Fetch revenue data
  useEffect(() => {
    async function fetchRevenueData() {
      try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now);
        monthStart.setDate(now.getDate() - 30);
        monthStart.setHours(0, 0, 0, 0);

        const [weekData, monthData] = await Promise.all([
          supabase
            .from('orders')
            .select('items:order_items(quantity, menu_items(price))')
            .eq('status', 'paid')
            .gte('created_at', weekStart.toISOString()),
          supabase
            .from('orders')
            .select('items:order_items(quantity, menu_items(price))')
            .eq('status', 'paid')
            .gte('created_at', monthStart.toISOString()),
        ]);

        if (weekData.error) throw weekData.error;
        if (monthData.error) throw monthData.error;

        const calcRevenue = (data) =>
          data.reduce(
            (sum, order) =>
              sum +
              order.items.reduce((s, item) => s + item.quantity * item.menu_items.price, 0),
            0,
          );

        setWeeklyRevenue(calcRevenue(weekData.data));
        setMonthlyRevenue(calcRevenue(monthData.data));
      } catch (err) {
        setError(`Failed to fetch revenue data: ${err.message}`);
      }
    }
    if (isLoggedIn && activeTab === 'Data Analytics') fetchRevenueData();
  }, [isLoggedIn, activeTab]);

  // Fetch menu items
  useEffect(() => {
    async function fetchMenu() {
      try {
        const { data, error } = await supabase.from('menu_items').select('*');
        if (error) throw error;
        console.log('Fetched menu items:', data);
        setMenuItems(data);
      } catch (err) {
        setError(`Failed to fetch menu: ${err.message}`);
      }
    }
    if (isLoggedIn) fetchMenu();
  }, [isLoggedIn]);

  // Fetch order history
  const fetchHistory = async () => {
    try {
      let startDate;
      let endDate;
      const today = new Date();
      switch (historyFilters.dateRange) {
        case 'today':
          startDate = new Date(today.setHours(0, 0, 0, 0));
          endDate = new Date(today.setHours(23, 59, 59, 999));
          break;
        case 'yesterday':
          startDate = new Date(today.setDate(today.getDate() - 1));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'last7days':
          startDate = new Date(today.setDate(today.getDate() - 7));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'custom':
          startDate = new Date(historyFilters.customStart.setHours(0, 0, 0, 0));
          endDate = new Date(historyFilters.customEnd.setHours(23, 59, 59, 999));
          break;
        default:
          return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*, tables(number), items:order_items(*, menu_items(name, price))')
        .in('status', historyFilters.statuses)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      if (error) throw error;
      setHistoryOrders(data);
    } catch (err) {
      setError(`Failed to fetch order history: ${err.message}`);
    }
  };

  useEffect(() => {
    if (isLoggedIn && activeTab === 'Order History') fetchHistory();
  }, [isLoggedIn, activeTab, historyFilters]);

  // Handle admin login
  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setIsLoggedIn(true);
    } catch (err) {
      setError(`Login failed: ${err.message}`);
    }
  };

  // Initiate mark as paid
  const initiateMarkAsPaid = (orderId) => {
    setSelectedOrderId(orderId);
    setPaymentType('');
    setShowPaymentModal(true);
  };

  // Mark order as paid
  const markAsPaid = async () => {
    if (!paymentType) {
      setError('Please select a payment method');
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'paid', payment_type: paymentType })
        .eq('id', selectedOrderId);
      if (error) throw error;

      setOrders((prev) => prev.filter((order) => order.id !== selectedOrderId));
      setShowPaymentModal(false);
      setSelectedOrderId(null);
      setPaymentType('');

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from('orders')
        .select('*, tables(number), items:order_items(*, menu_items(name, price))')
        .eq('status', 'paid')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString());
      setPaidOrders(data || []);
    } catch (err) {
      setError(`Failed to mark order as paid: ${err.message}`);
    }
  };

  // Start editing order
  const startEditing = (order) => {
    setEditingOrder(order);
    setEditedItems(
      order.items.map((item) => ({
        item_id: item.menu_items.id,
        name: item.menu_items.name,
        price: item.menu_items.price,
        quantity: item.quantity,
      })),
    );
  };

  // Update item quantity
  const updateQuantity = (index, delta) => {
    setEditedItems((prev) => {
      const newItems = [...prev];
      newItems[index].quantity = Math.max(1, newItems[index].quantity + delta);
      return newItems;
    });
  };

  // Remove item from edited order
  const removeItem = (index) => {
    setEditedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add item to edited order
  const addItem = (itemId) => {
    const menuItem = menuItems.find((item) => item.id === parseInt(itemId, 10));
    if (menuItem && !editedItems.some((item) => item.item_id === menuItem.id)) {
      setEditedItems((prev) => [
        ...prev,
        {
          item_id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
        },
      ]);
    }
  };

  // Save edited order
  const saveOrder = async () => {
    try {
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', editingOrder.id);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from('order_items').insert(
        editedItems.map((item) => ({
          order_id: editingOrder.id,
          menu_item_id: item.item_id,
          quantity: item.quantity,
        })),
      );
      if (insertError) throw insertError;

      const { data, error } = await supabase
        .from('orders')
        .select('*, tables(number), items:order_items(*, menu_items(name, price))')
        .eq('id', editingOrder.id)
        .single();
      if (error) throw error;

      setOrders((prev) => prev.map((o) => (o.id === editingOrder.id ? data : o)));
      setEditingOrder(null);
      setEditedItems([]);
    } catch (err) {
      setError(`Failed to update order: ${err.message}`);
    }
  };

  // Cancel order edit
  const cancelEdit = () => {
    setEditingOrder(null);
    setEditedItems([]);
  };

  // Add new menu item
  const addMenuItem = async () => {
    if (!newItem.name || !newItem.price) {
      setError('Name and price are required');
      return;
    }
    try {
      let imageUrl = null;
      if (newItem.image) {
        console.log('Uploading image:', newItem.image.name);
        const fileName = `${Date.now()}_${newItem.image.name.replace(/\s/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, newItem.image, { cacheControl: '3600', upsert: false });
        if (uploadError) {
          console.error('Image upload error:', uploadError);
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }
        const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName);
        if (!urlData.publicUrl) {
          throw new Error('Failed to get public URL for image');
        }
        imageUrl = urlData.publicUrl;
        console.log('Image uploaded, public URL:', imageUrl);
      }

      console.log('Inserting menu item:', { ...newItem, image_url: imageUrl });
      const { data, error } = await supabase
        .from('menu_items')
        .insert([
          {
            name: newItem.name,
            category: newItem.category || null,
            price: parseFloat(newItem.price),
            is_available: newItem.is_available,
            image_url: imageUrl,
          },
        ])
        .select();
      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Menu item added:', data[0]);
      setMenuItems((prev) => [...prev, data[0]]);
      setNewItem({ name: '', category: '', price: '', is_available: true, image: null });
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(`Failed to add item: ${err.message}`);
      console.error('Add menu item error:', err);
    }
  };

  // Update menu item image
  const updateMenuItemImage = async (itemId, file) => {
    try {
      console.log('Updating image for item:', itemId, file.name);
      const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        console.error('Image upload error:', uploadError);
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      if (!urlData.publicUrl) {
        throw new Error('Failed to get public URL for image');
      }
      const imageUrl = urlData.publicUrl;
      console.log('Image uploaded, public URL:', imageUrl);

      const { error: updateError } = await supabase
        .from('menu_items')
        .update({ image_url: imageUrl })
        .eq('id', itemId);
      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      console.log('Image updated for item:', itemId);
      setMenuItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, image_url: imageUrl } : item)),
      );
    } catch (err) {
      setError(`Failed to update image: ${err.message}`);
      console.error('Update image error:', err);
    }
  };

  // Remove menu item
  const removeMenuItem = async (itemId) => {
    try {
      console.log('Deleting menu item:', itemId);
      const item = menuItems.find((item) => item.id === itemId);
      if (item.image_url) {
        console.log('Removing image:', item.image_url);
        const fileName = item.image_url.split('/').pop();
        const { error: storageError } = await supabase.storage
          .from('menu-images')
          .remove([fileName]);
        if (storageError) {
          console.error('Image removal error:', storageError);
          throw new Error(`Image removal failed: ${storageError.message}`);
        }
        console.log('Image removed:', fileName);
      }

      const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
      if (error) {
        console.error('Database delete error:', error);
        throw error;
      }

      console.log('Menu item deleted:', itemId);
      setMenuItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      setError(`Failed to remove item: ${err.message}`);
      console.error('Remove menu item error:', err);
    }
  };

  // Toggle menu item availability
  const toggleAvailability = async (itemId, currentStatus) => {
    try {
      console.log('Toggling availability for:', itemId, currentStatus);
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !currentStatus })
        .eq('id', itemId);
      if (error) {
        console.error('Database update error:', error);
        throw error;
      }
      console.log('Availability toggled:', itemId, !currentStatus);
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, is_available: !currentStatus } : item,
        ),
      );
    } catch (err) {
      setError(`Failed to update availability: ${err.message}`);
      console.error('Toggle availability error:', err);
    }
  };

  // Print bill
  const printBill = (order) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      setError('Failed to open print window. Please allow pop-ups.');
      return;
    }

    const total = order.items.reduce(
      (sum, item) => sum + item.menu_items.price * item.quantity,
      0,
    );
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
              color: #333;
            }
            .receipt {
              width: 300px;
              padding: 10px;
              margin: 0 auto;
              background: white;
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
              border-top: 1px dashed #333;
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
              margin-top: 20px;
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
              <p>Table #${order.tables?.number || order.table_id}</p>
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
                ${order.items
                  .map(
                    (item) => `
                  <tr>
                    <td style="max-width: 180px; word-break: break-word;">${item.menu_items.name}</td>
                    <td class="right">${item.quantity}</td>
                    <td class="right">₹${(item.menu_items.price * item.quantity).toFixed(2)}</td>
                  </tr>
                `,
                  )
                  .join('')}
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
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Calculate analytics
  const getAnalytics = () => {
    const today = formatToISTDateForComparison(new Date());
    const todaysOrders = paidOrders.filter(
      (order) => formatToISTDateForComparison(new Date(order.created_at)) === today,
    );
    const totalOrders = todaysOrders.length;
    const totalRevenue = todaysOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((s, item) => s + item.menu_items.price * item.quantity, 0),
      0,
    );
    const itemCounts = {};
    todaysOrders.forEach((order) => {
      order.items.forEach((item) => {
        itemCounts[item.menu_items.name] =
          (itemCounts[item.menu_items.name] || 0) + item.quantity;
      });
    });
    const mostSoldItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0] || [
      'None',
      0,
    ];
    const ordersByHour = Array(24).fill(0);
    todaysOrders.forEach((order) => {
      const hour = parseInt(formatToISTHourOnly(order.created_at), 10);
      ordersByHour[hour]++;
    });
    const peakHour = ordersByHour.indexOf(Math.max(...ordersByHour));
    const totalItemsSold = todaysOrders.reduce(
      (sum, order) => sum + order.items.reduce((s, item) => s + item.quantity, 0),
      0,
    );
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalOrders, totalRevenue, mostSoldItem, peakHour, totalItemsSold, aov };
  };

  const analytics = getAnalytics();

  // Export orders to CSV
  const exportOrders = () => {
    const startDate = new Date(exportFilters.startDate.setHours(0, 0, 0, 0)).toISOString();
    const endDate = new Date(exportFilters.endDate.setHours(23, 59, 59, 999)).toISOString();
    const filteredOrders = historyOrders.filter((order) => {
      const orderDate = new Date(order.created_at).toISOString();
      return (
        orderDate >= startDate &&
        orderDate <= endDate &&
        exportFilters.statuses.includes(order.status)
      );
    });

    let csv;
    if (exportType === 'order') {
      csv = [
        'Order ID,Date,Table Number,Status,Total Amount,Items,Payment Method',
        ...filteredOrders.map((order) => {
          const total = order.items.reduce(
            (sum, item) => sum + item.menu_items.price * item.quantity,
            0,
          );
          const date = formatToISTDateOnly(new Date(order.created_at));
          const items = order.items
            .map((item) => `${item.menu_items.name} x${item.quantity}`)
            .join(', ');
          return `"${order.order_number || order.id}","${date}","${order.tables?.number || order.table_id}","${order.status}","${total.toFixed(2)}","${items}","${order.payment_type || 'N/A'}"`;
        }),
      ];
    } else {
      csv = [
        'Order ID,Date,Item,Quantity,Unit Price,Total Price,Status,Table Number,Payment Method',
        ...filteredOrders.flatMap((order) => {
          const date = formatToISTDateOnly(new Date(order.created_at));
          return order.items.map((item) => {
            const totalPrice = (item.menu_items.price * item.quantity).toFixed(2);
            return `"${order.order_number || order.id}","${date}","${item.menu_items.name}","${item.quantity}","${item.menu_items.price.toFixed(2)}","${totalPrice}","${order.status}","${order.tables?.number || order.table_id}","${order.payment_type || 'N/A'}"`;
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

  // Status filter component
  const StatusFilter = ({ statuses, onChange }) => (
    <div>
      <label className="block text-sm font-medium mb-1">Status</label>
      <div className="border p-3 rounded-lg bg-gray-100">
        {['pending', 'paid'].map((status) => (
          <label key={status} className="flex items-center gap-2">
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
              className="text-blue-500 rounded"
            />
            <span
              className={`capitalize ${
                status === 'paid' ? 'text-green-600' : 'text-yellow-600'
              }`}
            >
              {status}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 shadow-lg rounded-lg max-w-md w-full">
          <h1 className="text-lg font-semibold mb-6 text-center">Admin Dashboard</h1>
          {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-3 rounded-lg w-full mb-4"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-3 rounded-lg w-full mb-4"
          />
          <button
            type="button"
            className="bg-blue-500 text-white p-3 rounded-lg w-full hover:bg-blue-600"
            onClick={handleLogin}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg p-4 fixed h-full">
        <h1 className="text-gray-800 font-semibold text-lg mb-8">Table Management</h1>
        <nav>
          {['Pending Orders', 'Order History', 'Menu Management', 'Data Analytics'].map(
            (tab) => (
              <button
                key={tab}
                type="button"
                className={`w-full text-left py-3 px-4 mb-2 rounded-lg flex items-center gap-2 ${
                  activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'Pending Orders' && <ClipboardDocumentListIcon className="h-5 w-5" />}
                {tab === 'Order History' && <ClockIcon className="h-5 w-5" />}
                {tab === 'Menu Management' && <PlusIcon className="h-5 w-5" />}
                {tab === 'Data Analytics' && <ChartBarIcon className="h-5 w-5" />}
                {tab}
              </button>
            ),
          )}
        </nav>
        <button
          type="button"
          className="w-full mt-4 bg-red-600 text-white p-3 rounded-lg hover:bg-red-700"
          onClick={async () => {
            await supabase.auth.signOut();
            setIsLoggedIn(false);
            router.push('/admin');
          }}
        >
          Log Out
        </button>
      </div>

      {/* Main content */}
      <div className="ml-64 flex-1 p-6">
        {error && (
          <div className="bg-red-100 text-red-700 p-4 mb-6 rounded-lg">{error}</div>
        )}

        {/* Pending Orders */}
        {activeTab === 'Pending Orders' && (
          <div>
            <h2 className="text-gray-800 font-semibold text-lg mb-6">Pending Orders</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center">No pending orders</p>
            ) : (
              <div className="grid gap-4">
                {orders.map((order) => {
                  const total = order.items.reduce(
                    (sum, item) => sum + item.menu_items.price * item.quantity,
                    0,
                  );
                  return (
                    <div key={order.id} className="bg-white p-6 shadow-lg rounded-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">
                            Order #{order.order_number || order.id}
                          </h3>
                          <p className="text-gray-500 text-sm">{formatToIST(order.created_at)}</p>
                          <p className="text-gray-500 text-sm">
                            Table #{order.tables?.number || order.table_id}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
                            onClick={() => startEditing(order)}
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2"
                            onClick={() => initiateMarkAsPaid(order.id)}
                          >
                            Mark As Paid
                          </button>
                          <button
                            type="button"
                            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center gap-2"
                            onClick={() => printBill(order)}
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
                              <td className="py-2">{item.menu_items.name}</td>
                              <td className="text-right py-2">{item.quantity}</td>
                              <td className="text-right py-2">
                                ₹{(item.menu_items.price * item.quantity).toFixed(2)}
                              </td>
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

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Select Payment Method</h3>
              <select
                className="border p-2 rounded-lg w-full mb-4"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
              >
                <option value="">Select payment method</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="Credit Card">Credit Card</option>
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                  onClick={markAsPaid}
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Order Modal */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-lg w-full">
              <h3 className="text-lg font-semibold mb-4">
                Edit Order #{editingOrder.order_number || editingOrder.id}
              </h3>
              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-center py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {editedItems.map((item, index) => (
                    <tr key={index}>
                      <td className="py-2">{item.name}</td>
                      <td className="text-right py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="bg-gray-300 px-2 py-1 rounded"
                            onClick={() => updateQuantity(index, -1)}
                          >
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            className="bg-gray-300 px-2 py-1 rounded"
                            onClick={() => updateQuantity(index, 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="text-right py-2">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </td>
                      <td className="text-center py-2">
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => removeItem(index)}
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
                  className="border p-2 rounded-lg w-full"
                  onChange={(e) => addItem(e.target.value)}
                  value=""
                >
                  <option value="">Select an item</option>
                  {menuItems
                    .filter((item) => item.is_available)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} (₹{item.price.toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                  onClick={saveOrder}
                >
                  Save Order
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Order History */}
        {activeTab === 'Order History' && (
          <div>
            <h2 className="text-gray-800 font-semibold text-lg mb-6">Order History</h2>
            <div className="bg-white shadow p-6 rounded-lg mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date Range</label>
                  <select
                    className="border p-2 rounded-lg w-full"
                    value={historyFilters.dateRange}
                    onChange={(e) =>
                      setHistoryFilters({
                        ...historyFilters,
                        dateRange: e.target.value,
                        page: 1,
                      })
                    }
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
                        onChange={(date) =>
                          setHistoryFilters({
                            ...historyFilters,
                            customStart: date,
                            page: 1,
                          })
                        }
                        className="border p-2 rounded-lg w-full"
                      />
                      <DatePicker
                        selected={historyFilters.customEnd}
                        onChange={(date) =>
                          setHistoryFilters({
                            ...historyFilters,
                            customEnd: date,
                            page: 1,
                          })
                        }
                        className="border p-2 rounded-lg w-full"
                      />
                    </div>
                  )}
                </div>
                <StatusFilter
                  statuses={historyFilters.statuses}
                  onChange={(newStatuses) =>
                    setHistoryFilters({ ...historyFilters, statuses: newStatuses, page: 1 })
                  }
                />
              </div>
            </div>
            {historyOrders.length === 0 ? (
              <p className="text-gray-500 text-center">No orders found</p>
            ) : (
              <>
                <table className="w-full bg-white shadow rounded-lg">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">ID</th>
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Table</th>
                      <th className="text-right py-3 px-4">Total</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Payment</th>
                      <th className="text-center py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyOrders
                      .slice(
                        (historyFilters.page - 1) * historyFilters.perPage,
                        historyFilters.page * historyFilters.perPage,
                      )
                      .map((order) => {
                        const total = order.items.reduce(
                          (sum, item) => sum + item.menu_items.price * item.quantity,
                          0,
                        );
                        return (
                          <tr key={order.id} className="border-b">
                            <td className="py-3 px-4">{order.order_number || order.id}</td>
                            <td className="py-3 px-4">{formatToIST(order.created_at)}</td>
                            <td className="py-3 px-4">{order.tables?.number || order.table_id}</td>
                            <td className="text-right py-3 px-4">₹{total.toFixed(2)}</td>
                            <td className="py-3 px-4 capitalize">{order.status}</td>
                            <td className="py-3 px-4">{order.payment_type || 'N/A'}</td>
                            <td className="text-center py-3 px-4 flex gap-2 justify-center">
                              <button
                                type="button"
                                className="text-blue-500 hover:text-blue-600"
                                onClick={() => setViewingOrder(order)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="text-gray-500 hover:text-gray-600"
                                onClick={() => printBill(order)}
                              >
                                <PrinterIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                <div className="flex justify-between mt-4 items-center">
                  <button
                    type="button"
                    className="bg-gray-300 px-4 py-2 rounded-lg disabled:opacity-50"
                    onClick={() =>
                      setHistoryFilters({
                        ...historyFilters,
                        page: historyFilters.page - 1,
                      })
                    }
                    disabled={historyFilters.page === 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {historyFilters.page} of{' '}
                    {Math.ceil(historyOrders.length / historyFilters.perPage)}
                  </span>
                  <button
                    type="button"
                    className="bg-gray-300 px-4 py-2 rounded-lg disabled:opacity-50"
                    onClick={() =>
                      setHistoryFilters({
                        ...historyFilters,
                        page: historyFilters.page + 1,
                      })
                    }
                    disabled={
                      historyFilters.page * historyFilters.perPage >= historyOrders.length
                    }
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* View Order Modal */}
        {viewingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-lg w-full">
              <h3 className="text-lg font-semibold mb-4">
                Invoice #{viewingOrder.order_number || viewingOrder.id}
              </h3>
              <p className="text-gray-500 text-sm mb-2">
                {formatToIST(viewingOrder.created_at)}
              </p>
              <p className="text-gray-500 text-sm mb-2">
                Table {viewingOrder.tables?.number || viewingOrder.table_id}
              </p>
              <p className="text-gray-500 text-sm mb-4">
                Payment: {viewingOrder.payment_type || 'N/A'}
              </p>
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
                      <td className="py-2">{item.menu_items.name}</td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">
                        ₹{(item.menu_items.price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between mb-4 font-semibold">
                <span>Total</span>
                <span>
                  ₹
                  {viewingOrder.items
                    .reduce(
                      (sum, item) => sum + item.menu_items.price * item.quantity,
                      0,
                    )
                    .toFixed(2)}
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400"
                  onClick={() => setViewingOrder(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
                  onClick={() => printBill(viewingOrder)}
                >
                  <PrinterIcon className="h-5 w-5" />
                  Print
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Menu Management */}
        {activeTab === 'Menu Management' && (
          <div>
            <h2 className="text-gray-800 font-semibold text-lg mb-6">Menu Management</h2>
            <div className="bg-white shadow p-6 rounded-lg mb-6">
              <h3 className="font-semibold mb-4">Add New Menu Item</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="border p-2 rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="border p-2 rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="border p-2 rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewItem({ ...newItem, image: e.target.files[0] })}
                    className="border p-2 rounded-lg w-full"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newItem.is_available}
                      onChange={(e) =>
                        setNewItem({ ...newItem, is_available: e.target.checked })
                      }
                      className="text-blue-500"
                    />
                    Available
                  </label>
                </div>
              </div>
              <button
                type="button"
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                onClick={addMenuItem}
              >
                Add Item
              </button>
            </div>
            <h3 className="font-semibold mb-4">Menu Items</h3>
            <table className="w-full bg-white shadow rounded-lg">
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
                {menuItems.map((item) => (
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
                          className="w-12 h-12 object-cover rounded mx-auto"
                          onError={(e) => {
                            e.target.src =
                              'https://images.unsplash.com/photo-1550547660-d9450f859349';
                          }}
                        />
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => updateMenuItemImage(item.id, e.target.files[0])}
                          className="mx-auto"
                        />
                      )}
                    </td>
                    <td className="text-center py-3 px-4 flex gap-2 justify-center">
                      <button
                        type="button"
                        className="text-blue-500 hover:text-blue-600"
                        onClick={() => toggleAvailability(item.id, item.is_available)}
                      >
                        {item.is_available ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => removeMenuItem(item.id)}
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

        {/* Data Analytics */}
        {activeTab === 'Data Analytics' && (
          <div>
            <h2 className="text-gray-800 font-semibold text-lg mb-6">Data Analytics</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">Total Orders</h3>
                <p className="text-2xl">{analytics.totalOrders}</p>
              </div>
              <div className="bg-green-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">Total Revenue</h3>
                <p className="text-2xl">₹{analytics.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-purple-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">Most Sold</h3>
                <p className="text-lg">{analytics.mostSoldItem[0]}</p>
                <p className="text-sm">{analytics.mostSoldItem[1]} units</p>
              </div>
              <div className="bg-orange-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">Peak Hour</h3>
                <p className="text-2xl">
                  {analytics.peakHour === -1 ? 'N/A' : `${analytics.peakHour}:00`}
                </p>
              </div>
              <div className="bg-teal-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">Weekly Revenue</h3>
                <p className="text-2xl">₹{weeklyRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-indigo-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">Monthly Revenue</h3>
                <p className="text-2xl">₹{monthlyRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-pink-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">Average Order Value</h3>
                <p className="text-2xl">₹{analytics.aov.toFixed(2)}</p>
              </div>
              <div className="bg-yellow-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">Total Items Sold</h3>
                <p className="text-2xl">{analytics.totalItemsSold}</p>
              </div>
            </div>
            <div className="bg-white shadow p-6 rounded-lg">
              <h3 className="font-semibold mb-4">Export Order Data</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Export Type</label>
                  <select
                    className="border p-2 rounded-lg w-full"
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                  >
                    <option value="order">Order Summary</option>
                    <option value="items">Itemized List</option>
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
              </div>
              <StatusFilter
                statuses={exportFilters.statuses}
                onChange={(newStatuses) =>
                  setExportFilters({ ...exportFilters, statuses: newStatuses })
                }
              />
              <button
                type="button"
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                onClick={exportOrders}
              >
                Export Orders
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}