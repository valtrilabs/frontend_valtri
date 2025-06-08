import { useState, useEffect } from 'react';
import useSWR from 'swr';
import BottomCart from '../components/BottomCart';
import { CakeIcon } from '@heroicons/react/24/outline';
import { format, add } from 'date-fns';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Waiter() {
  const [activeTab, setActiveTab] = useState('take-order');
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState([]);
  const [orderNote, setOrderNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [error, setError] = useState(null);
  const [addedItems, setAddedItems] = useState({});
  const [pendingOrders, setPendingOrders] = useState([]);
  const [filterTableNumber, setFilterTableNumber] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);

  // Function to convert UTC to IST
  const formatToIST = (date) => {
    const utcDate = new Date(date);
    const istDate = add(utcDate, { hours: 5, minutes: 30 });
    return format(istDate, 'dd/MM/yyyy, hh:mm a');
  };

  // Fetch menu items
  const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const { data: menu, error: menuError, isLoading: isMenuLoading } = useSWR(`${apiUrl}/api/menu`, fetcher);

  // Fetch pending orders
  const { data: ordersData, error: ordersError, isLoading: isOrdersLoading, mutate: mutateOrders } = useSWR(
    `${apiUrl}/api/orders?status=pending`,
    fetcher
  );

  // Update pending orders
  useEffect(() => {
    if (ordersData) {
      setPendingOrders(ordersData);
    }
    if (ordersError) {
      console.error('Pending orders fetch error:', ordersError);
      if (activeTab === 'pending-orders') {
        setError('Failed to load pending orders. Please try again later.');
      }
    }
  }, [ordersData, ordersError, activeTab]);

  // Handle menu errors
  useEffect(() => {
    if (menuError) {
      setError('Failed to load menu. Please try again.');
    }
  }, [menuError]);

  // Unique categories
  const categories = ['All', ...new Set(menu?.map((item) => item.category).filter(Boolean))];

  // Filtered menu
  const filteredMenu = menu
    ? menu
        .filter((item) => selectedCategory === 'All' || item.category === selectedCategory)
        .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // Add to cart
  const addToCart = (item) => {
    setAddedItems((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [item.id]: false }));
    }, 1000);
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.item_id === item.id);
      if (existingItem) {
        return prevCart.map((cartItem) =>
          cartItem.item_id === item.id ? { ...cartItem, quantity: (cartItem.quantity || 1) + 1 } : cartItem
        );
      }
      return [
        ...prevCart,
        {
          item_id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          image_url: item.image_url,
          quantity: 1,
        },
      ];
    });
    setIsCartOpen(true);
  };

  // Place new order
  const placeOrder = async () => {
    if (!tableNumber) return setError('Please enter a table number.');
    if (parseInt(tableNumber) < 1 || parseInt(tableNumber) > 30) {
      return setError('Table number must be between 1 and 30.');
    }
    if (cart.length === 0) return setError('Cart is empty.');
    const maxRetries = 3;
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        setError(null);
        const response = await fetch(`${apiUrl}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: parseInt(tableNumber),
            items: cart,
            notes: orderNote || null,
          }),
          signal: AbortSignal.timeout(30000),
        });
        const order = await response.json();
        if (!response.ok || !order.id) {
          throw new Error(order.error || `HTTP ${response.status}`);
        }
        setCart([]);
        setTableNumber('');
        setOrderNote('');
        setIsCartOpen(false);
        setError('Order placed successfully!');
        mutateOrders();
        return;
      } catch (err) {
        attempts++;
        if (attempts === maxRetries) {
          setError(`Failed to place order after ${maxRetries} attempts: ${err.message}`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  // Edit order
  const startEditingOrder = (order) => {
    console.log('startEditingOrder called with order:', order);
    if (!order || !order.id || !order.items || !order.table_id) {
      console.error('Invalid order data:', order);
      setError('Cannot edit order: Invalid order data.');
      return;
    }

    setEditingOrder({
      orderId: order.id,
      tableNumber: order.table_id,
      items: order.items,
      notes: order.notes || '',
    });
    setCart(order.items);
    setTableNumber(order.table_id.toString());
    setOrderNote(order.notes || '');
    setIsCartOpen(true);
    setActiveTab('pending-orders');
    console.log('State after setting:', {
      editingOrder: {
        orderId: order.id,
        tableNumber: order.table_id,
        items: order.items,
        notes: order.notes || '',
      },
      cart: order.items,
      tableNumber: order.table_id.toString(),
      orderNote: order.notes || '',
      isCartOpen: true,
      activeTab: 'pending-orders',
    });
  };

  // Save edited order
  const saveEditedOrder = async () => {
    if (!editingOrder) return;
    if (cart.length === 0) return setError('Cart is empty.');
    const maxRetries = 3;
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        setError(null);
        const response = await fetch(`${apiUrl}/api/orders/${editingOrder.orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart,
            notes: orderNote || null,
          }),
          signal: AbortSignal.timeout(30000),
        });
        const order = await response.json();
        if (!response.ok || !order.id) {
          throw new Error(order.error || `HTTP ${response.status}`);
        }
        setCart([]);
        setTableNumber('');
        setOrderNote('');
        setIsCartOpen(false);
        setEditingOrder(null);
        setError('Order updated successfully!');
        mutateOrders();
        return;
      } catch (err) {
        attempts++;
        if (attempts === maxRetries) {
          setError(`Failed to update order after ${maxRetries} attempts: ${err.message}`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  // Refresh page
  const refreshPage = () => {
    window.location.reload();
  };

  // Filtered orders
  const filteredOrders = filterTableNumber
    ? pendingOrders.filter((order) => order.table_id.toString() === filterTableNumber)
    : pendingOrders;

  if (isMenuLoading && isOrdersLoading) {
    return <div className="text-center mt-10" role="status">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 bg-gray-50">
      {/* Header */}
      <div className="flex items-center items-center gap-2 mb">
        <CakeIcon className="h-6 w-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-800" aria-label="Waiter Interface for Gsaheb Cafe">
          Waiter Interface - Gsaheb Cafe
        </h1>
        <CakeIcon className="h-6 w-6 text-blue-500" />
      </div>

      {/* Tabs */}
      <div className="flex mb-6">
        <button
          className={`flex-1 py-2 px-4 rounded-l-lg ${
            activeTab === 'take-order' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => setActiveTab('take-order')}
        >
          Take Order
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-r-lg ${
            activeTab === 'pending-orders' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => setActiveTab('pending-orders')}
        >
          Pending Orders
        </button>
      </div>

      {/* Error/Success Message */}
      {error && (
        <div className="mb-4 flex flex-col items-center justify-center" role="alert">
          <p className={`text-center ${error.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
            {error}
          </p>
          {error.includes('successfully') && (
            <button
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={refreshPage}
            >
              Refresh
            </button>
          )}
        </div>
      )}

      {/* Take Order Panel */}
      {activeTab === 'take-order' && (
        <div>
          {/* Table Number Input */}
          <div className="mb-6">
            <label htmlFor="table-number" className="block text-sm font-semibold text-gray-800 mb-2">
              Table Number (1–30)
            </label>
            <input
              type="number"
              id="table-number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white text-gray-800 placeholder-gray-400"
              placeholder="Enter table number (1–30)"
              min="1"
              max="30"
              required
            />
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <label htmlFor="search-bar" className="block text-sm font-semibold text-gray-800 mb-2">
              Search Menu
            </label>
            <input
              type="text"
              id="search-bar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white text-gray-800 placeholder-gray-400"
              placeholder="Search for menu items..."
            />
          </div>

          {/* Category Filters */}
          <div className="mb-6 overflow-x-auto whitespace-nowrap pb-2" role="tablist" aria-label="Menu categories">
            <div className="flex gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => setSelectedCategory(category)}
                  role="tab"
                  aria-selected={selectedCategory === category}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4" role="region" aria-live="polite">
            {filteredMenu.length === 0 ? (
              <p className="col-span-full text-center text-gray-500">No items found.</p>
            ) : (
              filteredMenu.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                >
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349'}
                    alt={item.name}
                    className="w-full h-32 object-cover rounded-md mb-2"
                  />
                  <h2 className="font-semibold text-lg">{item.name}</h2>
                  <p className="text-sm text-gray-500">{item.category}</p>
                  <p className="text-sm font-medium">₹{item.price.toFixed(2)}</p>
                  <button
                    className={`mt-2 w-full py-2 rounded-lg text-white transition-colors duration-300 ${
                      addedItems[item.id]
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                    onClick={() => addToCart(item)}
                    aria-label={addedItems[item.id] ? `${item.name} added to cart` : `Add ${item.name} to cart`}
                  >
                    {addedItems[item.id] ? 'Added' : 'Add to Cart'}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Order Note */}
          <div className="mt-4">
            <label htmlFor="order-note" className="block text-sm font-semibold text-gray-800 mb-2">
              Order Note (Optional)
            </label>
            <textarea
              id="order-note"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white text-gray-800 placeholder-gray-400"
              placeholder="E.g., No onions, extra spicy"
              rows="3"
            />
          </div>
        </div>
      )}

      {/* Pending Orders Panel */}
      {activeTab === 'pending-orders' && (
        <div>
          {isOrdersLoading ? (
            <div className="text-center mt-10" role="status">Loading pending orders...</div>
          ) : (
            <>
              {/* Filter by Table Number */}
              <div className="mb-4">
                <label htmlFor="filter-table-number" className="block text-sm font-semibold text-gray-800 mb-2">
                  Filter by Table Number
                </label>
                <input
                  type="number"
                  id="filter-table-number"
                  value={filterTableNumber}
                  onChange={(e) => setFilterTableNumber(e.target.value)}
                  className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white text-gray-800 placeholder-gray-400"
                  placeholder="Enter table number (1–30)"
                  min="1"
                  max="30"
                />
              </div>

              {/* Pending Orders List */}
              <div className="space-y-4">
                {filteredOrders.length === 0 ? (
                  <p className="text-center text-gray-500">No pending orders.</p>
                ) : (
                  filteredOrders.map((order) => (
                    <div key={order.id} className="bg-white p-6 rounded-lg shadow">
                      <div className="mb-4">
                        <p className="text-lg font-semibold">Order #{order.order_number || order.id}</p>
                        <p className="text-sm text-gray-500">
                          Table {order.tables?.number || order.table_id}
                        </p>
                        <p className="text-sm text-gray-500">
                          Placed on {formatToIST(order.created_at)}
                        </p>
                        {order.notes && (
                          <p className="text-sm text-gray-700 mt-2">
                            <strong>Note:</strong> {order.notes}
                          </p>
                        )}
                      </div>
                      <h2 className="font-semibold text-lg mb-2">Items</h2>
                      <ul className="mb-4">
                        {order.items.map((item, index) => (
                          <li key={index} className="flex justify-between">
                            <span>
                              {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}{' '}
                              {item.note && `(${item.note})`}
                            </span>
                            <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="font-semibold">
                        Total: ₹
                        {order.items
                          .reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)
                          .toFixed(2)}
                      </p>
                      <button
                        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        onClick={() => startEditingOrder(order)}
                        aria-label={`Edit order ${order.order_number || order.id}`}
                      >
                        Edit Order
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom Cart */}
      <BottomCart
        cart={cart}
        setCart={setCart}
        onPlaceOrder={editingOrder ? saveEditedOrder : placeOrder}
        onClose={() => {
          setIsCartOpen(false);
          if (editingOrder) {
            setEditingOrder(null);
            setCart([]);
            setTableNumber('');
            setOrderNote('');
          }
        }}
        isOpen={isCartOpen}
        tableNumber={tableNumber}
        orderNote={orderNote}
        isEditing={!!editingOrder}
        menu={menu || []}
      />
    </div>
  );
}