import { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import BottomCart from '../components/BottomCart';
import { CakeIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { format, add } from 'date-fns';

const fetcher = (url) => fetch(url).then((res) => res.json());

function ErrorBoundary({ children }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (error) => {
      console.error('ErrorBoundary caught:', error);
      setHasError(true);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" role="alert">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
          <p className="mt-4">Please refresh the page or contact support.</p>
        </div>
      </div>
    );
  }
  return children;
}

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
  const [searchOrders, setSearchOrders] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [sliderRef, setSliderRef] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const confirmButtonRef = useRef(null);
  const itemsPerPage = 5;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');

  // Format UTC to IST
  const formatToIST = (date) => {
    const utcDate = new Date(date);
    const istDate = add(utcDate, { hours: 5, minutes: 30 });
    return format(istDate, 'dd/MM/yyyy, hh:mm a');
  };

  // Fetch menu items
  const { data: menu, error: menuError, isLoading: isMenuLoading } = useSWR(`${apiUrl}/api/menu`, fetcher);

  // Fetch pending orders
  const { data: ordersData, error: ordersError, isLoading: isOrdersLoading, mutate: mutateOrders } = useSWR(
    `${apiUrl}/api/orders?status=pending`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Update pending orders
  useEffect(() => {
    if (ordersData) {
      setPendingOrders(ordersData);
      if (activeTab === 'pending-orders' && ordersData.length > pendingOrders.length) {
        setError('New pending order received!');
        setTimeout(() => setError(null), 3000);
      }
    }
    if (ordersError) {
      console.error('Pending orders fetch error:', ordersError);
      if (activeTab === 'pending-orders') {
        setError('Failed to load pending orders. Please try again later.');
      }
    }
  }, [ordersData, ordersError, activeTab, pendingOrders.length]);

  // Handle menu errors
  useEffect(() => {
    if (menuError) {
      setError('Failed to load menu. Please try again.');
    }
  }, [menuError]);

  // Track slider scroll
  useEffect(() => {
    const handleScroll = () => {
      if (sliderRef) {
        setIsScrolled(sliderRef.scrollLeft > 0);
      }
    };
    sliderRef?.addEventListener('scroll', handleScroll);
    return () => sliderRef?.removeEventListener('scroll', handleScroll);
  }, [sliderRef]);

  // Focus on confirm button when modal opens
  useEffect(() => {
    if (showConfirm && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [showConfirm]);

  // Memoized categories and filtered menu
  const categories = useMemo(() => ['All', ...new Set(menu?.map(item => item.category).filter(Boolean))], [menu]);
  const filteredMenu = useMemo(() =>
    menu
      ? menu
          .filter(item => selectedCategory === 'All' || item.category === selectedCategory)
          .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : [],
    [menu, selectedCategory, searchQuery]
  );

  // Add to cart
  const addToCart = (item) => {
    setAddedItems(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedItems(prev => ({ ...prev, [item.id]: false }));
    }, 1000);
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.item_id === item.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.item_id === item.id
            ? { ...cartItem, quantity: (cartItem.quantity || 1) + 1 }
            : cartItem
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
    setError('Item added to cart!');
    setTimeout(() => setError(null), 3000);
    console.log('Analytics - Item added:', {
      item_id: item.id,
      name: item.name,
      timestamp: new Date().toISOString(),
      table_id: tableNumber || 'N/A',
      is_editing: !!editingOrder,
    });
  };

  // Place new order
  const placeOrder = async () => {
    if (!tableNumber) {
      setError('Please enter a table number.');
      setShowConfirm(false);
      return;
    }
    if (parseInt(tableNumber) < 1 || parseInt(tableNumber) > 30) {
      setError('Table number must be between 1 and 30.');
      setShowConfirm(false);
      return;
    }
    if (cart.length === 0) {
      setError('Cart is empty.');
      setShowConfirm(false);
      return;
    }
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
            is_waiter_order: true, // Flag to bypass geolocation
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
        setError('Order placed successfully! Refreshing in 3 seconds...');
        setTimeout(() => window.location.reload(), 3000);
        mutateOrders();
        setShowConfirm(false);
        return;
      } catch (err) {
        attempts++;
        if (attempts === maxRetries) {
          setError(`Failed to place order after ${maxRetries} attempts: ${err.message}`);
          setShowConfirm(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // Save edited order
  const saveEditedOrder = async () => {
    if (!editingOrder) {
      setError('No order selected for editing.');
      setShowConfirm(false);
      return;
    }
    if (cart.length === 0) {
      setError('Cart is empty.');
      setShowConfirm(false);
      return;
    }
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
            is_waiter_order: true, // Flag to bypass geolocation
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
        setError('Order updated successfully! Refreshing in 3 seconds...');
        setTimeout(() => window.location.reload(), 3000);
        mutateOrders();
        setShowConfirm(false);
        return;
      } catch (err) {
        attempts++;
        if (attempts === maxRetries) {
          setError(`Failed to update order after ${maxRetries} attempts: ${err.message}`);
          setShowConfirm(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // Edit order
  const startEditingOrder = (order) => {
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
    console.log('Analytics - Start editing order:', {
      order_id: order.id,
      table_id: order.table_id,
      timestamp: new Date().toISOString(),
    });
  };

  // Handle confirmation
  const handleConfirm = (action) => {
    setConfirmAction(() => action);
    setShowConfirm(true);
    setIsCartOpen(false);
  };

  // Scroll slider
  const scrollLeft = () => {
    if (sliderRef) sliderRef.scrollBy({ left: -100, behavior: 'smooth' });
  };
  const scrollRight = () => {
    if (sliderRef) sliderRef.scrollBy({ left: 100, behavior: 'smooth' });
  };

  // Sort and paginate orders
  const sortedOrders = useMemo(() =>
    [...pendingOrders].sort((a, b) => {
      const aValue = sortBy === 'created_at' ? new Date(a[sortBy]).getTime() : a[sortBy];
      const bValue = sortBy === 'created_at' ? new Date(b[sortBy]).getTime() : b[sortBy];
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }),
    [pendingOrders, sortBy, sortOrder]
  );

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = sortedOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Filtered and searched orders
  const filteredOrders = useMemo(() =>
    paginatedOrders.filter(order => {
      const matchesTable = filterTableNumber
        ? order.table_id.toString() === filterTableNumber
        : true;
      const matchesSearch = searchOrders
        ? order.order_number?.toString().includes(searchOrders) ||
          order.items.some(item => item.name.toLowerCase().includes(searchOrders.toLowerCase())) ||
          (order.notes || '').toLowerCase().includes(searchOrders.toLowerCase())
        : true;
      return matchesTable && matchesSearch;
    }),
    [paginatedOrders, filterTableNumber, searchOrders]
  );

  return (
    <ErrorBoundary>
      <section className="min-h-screen bg-gray-50 p-4">
        {/* Header */}
        <header className="flex items-center justify-center gap-2 mb-6">
          <CakeIcon className="h-6 w-6 text-blue-500" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-800" aria-label="Waiter Interface for Valtri Labs Cafe">
            Waiter Interface - Valtri Labs Cafe
          </h1>
          <CakeIcon className="h-6 w-6 text-blue-500" aria-hidden="true" />
        </header>

        {/* Toast Notification */}
        {error && (
          <div
            className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-[110] flex items-center gap-2 animate-fade-in ${
              error.includes('successfully') || error.includes('received') || error.includes('added')
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-800 font-semibold'
            }`}
            role="alert"
            aria-live="assertive"
          >
            <p>{error}</p>
            <button
              className="text-sm font-medium hover:underline"
              onClick={() => setError(null)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" role="dialog" aria-modal="true">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {editingOrder ? 'Confirm Order Changes' : 'Confirm Order'}
              </h2>
              <p className="text-gray-700 mb-6">
                {editingOrder
                  ? `Save changes to Order #${editingOrder.orderId} for Table ${tableNumber} with ${cart.length} items?`
                  : `Place order for Table ${tableNumber} with ${cart.length} items for ₹${cart
                      .reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)
                      .toFixed(2)}?`}
              </p>
              <div className="flex gap-4">
                <button
                  className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  onClick={() => {
                    setShowConfirm(false);
                    setIsCartOpen(true);
                  }}
                  aria-label="Cancel order action"
                >
                  Cancel
                </button>
                <button
                  ref={confirmButtonRef}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={confirmAction}
                  aria-label={editingOrder ? 'Confirm save order changes' : 'Confirm place order'}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex mb-6 rounded-lg shadow-sm overflow-hidden" role="tablist" aria-label="Order Management Tabs">
          <button
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'take-order' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setActiveTab('take-order')}
            role="tab"
            aria-selected={activeTab === 'take-order'}
            aria-controls="take-order-panel"
          >
            Take Order
          </button>
          <button
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'pending-orders' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setActiveTab('pending-orders')}
            role="tab"
            aria-selected={activeTab === 'pending-orders'}
            aria-controls="pending-orders-panel"
          >
            Pending Orders
          </button>
        </div>

        {/* Take Order Panel */}
        {activeTab === 'take-order' && (
          <section id="take-order-panel" role="tabpanel" aria-labelledby="take-order">
            {/* Sticky Table Number Input */}
            <div className="sticky top-4 z-10 bg-gray-50 pb-4">
              <div className="mb-6 max-w-2xl mx-auto">
                <label htmlFor="table-number" className="block text-sm font-semibold text-gray-800 mb-2">
                  Table Number (1–30)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="table-number"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 bg-white text-gray-800 placeholder-gray-400 transition-all"
                    placeholder="Enter table number (1–30)"
                    min="1"
                    max="30"
                    required
                    aria-describedby="table-number-help"
                  />
                  <p id="table-number-help" className="mt-1 text-xs text-gray-500">
                    Enter a number between 1 and 30 for the table.
                  </p>
                  {tableNumber && (parseInt(tableNumber) < 1 || parseInt(tableNumber) > 30) && (
                    <p className="mt-1 text-xs text-red-500" aria-live="polite">
                      Table number must be between 1 and 30.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6 max-w-2xl mx-auto">
              <label htmlFor="search-bar" className="block text-sm font-semibold text-gray-800 mb-2">
                Search Menu
              </label>
              <input
                type="text"
                id="search-bar"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 bg-white text-gray-800 placeholder-gray-400 transition-all"
                placeholder="Search for menu items..."
                aria-describedby="search-bar-help"
              />
              <p id="search-bar-help" className="mt-1 text-xs text-gray-500">
                Type to filter menu items by name.
              </p>
            </div>

            {/* Category Filters */}
            <div className="mb-6 relative max-w-2xl mx-auto">
              <div
                className={`flex overflow-x-auto space-x-2 pb-2 -mx-4 px-4 scrollbar-hide ${
                  isScrolled ? 'bg-gradient-to-l from-gray-200 to-transparent' : 'bg-gradient-to-r from-transparent to-gray-200'
                }`}
                ref={setSliderRef}
                role="tablist"
                aria-label="Menu categories"
              >
                {categories.map((category, index) => (
                  <button
                    key={category}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-transform duration-200 ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    } ${index === 0 ? 'animate-bounce-once' : ''}`}
                    onClick={() => setSelectedCategory(category)}
                    role="tab"
                    aria-selected={selectedCategory === category}
                    aria-controls="menu-items"
                    style={{ transform: selectedCategory === category ? 'scale(1.05)' : 'scale(1)' }}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <button
                className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 bg-gray-200 text-gray-700 p-2 rounded-full hover:bg-gray-300"
                onClick={scrollLeft}
                aria-label="Scroll categories left"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 bg-gray-200 text-gray-700 p-2 rounded-full hover:bg-gray-300"
                onClick={scrollRight}
                aria-label="Scroll categories right"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
              <p className="text-xs text-gray-500 mt-1 text-center animate-fade-in" id="slider-hint">
                Scroll for more categories
              </p>
            </div>

            {/* Menu Items Grid */}
            <div
              id="menu-items"
              className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto"
              role="region"
              aria-live="polite"
            >
              {isMenuLoading ? (
                <div className="col-span-full grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white p-3 rounded-lg shadow-md">
                      <div className="w-full h-28 bg-gray-200 rounded-md animate-pulse"></div>
                      <div className="mt-2 h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                      <div className="mt-1 h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                      <div className="mt-1 h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                      <div className="mt-2 h-10 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : filteredMenu.length === 0 ? (
                <p className="col-span-full text-center text-gray-500">No items found.</p>
              ) : (
                filteredMenu.map(item => {
                  const cartItem = cart.find(cartItem => cartItem.item_id === item.id);
                  const quantity = cartItem ? cartItem.quantity || 1 : 0;
                  return (
                    <article
                      key={item.id}
                      className="bg-white p-3 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between min-h-[280px]"
                    >
                      <div>
                        <img
                          src={item.image_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349'}
                          alt={item.name}
                          className="w-full h-28 object-cover rounded-md mb-2"
                        />
                        <h2
                          className="font-semibold text-base text-gray-800 line-clamp-2 mb-2"
                          title={item.name}
                        >
                          {item.name}
                        </h2>
                        <p className="text-sm text-gray-600 block mb-0.5">{item.category}</p>
                        <p className="text-sm font-medium text-gray-800">₹{item.price.toFixed(2)}</p>
                      </div>
                      <div className="relative mt-auto">
                        <button
                          className={`w-full py-2 rounded-lg text-white text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                            quantity > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-500 hover:bg-green-600'
                          }`}
                          onClick={() => addToCart(item)}
                          aria-label={quantity > 0 ? `${item.name} added to cart` : `Add ${item.name} to cart`}
                        >
                          <span className={quantity > 0 ? 'flex items-center justify-center gap-1' : ''}>
                            {quantity > 0 ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Added
                              </>
                            ) : (
                              'Add to Cart'
                            )}
                          </span>
                        </button>
                        {quantity > 0 && (
                          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            x{quantity}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Order Note */}
            <div className="mt-6 max-w-2xl mx-auto">
              <label htmlFor="order-note" className="block text-sm font-semibold text-gray-800 mb-2">
                Order Note (Optional)
              </label>
              <textarea
                id="order-note"
                value={orderNote}
                onChange={e => setOrderNote(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 bg-white text-gray-800 placeholder-gray-400 transition-all"
                placeholder="E.g., No onions, extra spicy"
                rows="3"
                aria-describedby="order-note-help"
              />
              <p id="order-note-help" className="mt-1 text-xs text-gray-500">
                Add special instructions for this order.
              </p>
            </div>
          </section>
        )}

        {/* Pending Orders Panel */}
        {activeTab === 'pending-orders' && (
          <section id="pending-orders-panel" role="tabpanel" aria-labelledby="pending-orders">
            {isOrdersLoading ? (
              <div className="col-span-full space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white p-6 rounded-lg shadow-md">
                    <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                    <div className="mt-2 h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                    <div className="mt-1 h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                    <div className="mt-4 h-6 bg-gray-200 rounded w-1/5 animate-pulse"></div>
                    <div className="mt-2 h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                    <div className="mt-4 h-10 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Filter and Sort Controls */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
                  <div className="flex-1">
                    <label htmlFor="filter-table-number" className="block text-sm font-semibold text-gray-800 mb-2">
                      Filter by Table Number
                    </label>
                    <input
                      type="number"
                      id="filter-table-number"
                      value={filterTableNumber}
                      onChange={e => setFilterTableNumber(e.target.value)}
                      className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 bg-white text-gray-800 placeholder-gray-400 transition-all"
                      placeholder="Enter table number (1–30)"
                      min="1"
                      max="30"
                      aria-describedby="filter-table-help"
                    />
                    <p id="filter-table-help" className="mt-1 text-xs text-gray-500">
                      Filter orders by table number.
                    </p>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="search-orders" className="block text-sm font-semibold text-gray-800 mb-2">
                      Search Orders
                    </label>
                    <input
                      type="text"
                      id="search-orders"
                      value={searchOrders}
                      onChange={e => setSearchOrders(e.target.value)}
                      className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 bg-white text-gray-800 placeholder-gray-400 transition-all"
                      placeholder="Search by order #, item, or note..."
                      aria-describedby="search-orders-help"
                    />
                    <p id="search-orders-help" className="mt-1 text-xs text-gray-500">
                      Search orders by number, item name, or notes.
                    </p>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="sort-by" className="block text-sm font-semibold text-gray-800 mb-2">
                      Sort By
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="sort-by"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="flex-1 p-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 bg-white text-gray-800"
                        aria-label="Sort orders by"
                      >
                        <option value="created_at">Order Time</option>
                        <option value="table_id">Table Number</option>
                        <option value="order_number">Order Number</option>
                      </select>
                      <button
                        className="p-3 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                        aria-describedby="sort-order-help"
                      >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </button>
                      <p id="sort-order-help" className="sr-only">
                        Sorts orders {sortOrder === 'asc' ? 'ascending' : 'descending'} by {sortBy === 'created_at' ? 'order time' : sortBy === 'table_id' ? 'table number' : 'order number'}.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pending Orders List */}
                <div className="space-y-4 max-w-2xl mx-auto">
                  {filteredOrders.length === 0 ? (
                    <p className="text-center text-gray-500">No pending orders.</p>
                  ) : (
                    filteredOrders.map(order => (
                      <article
                        key={order.id}
                        className={`bg-white p-6 rounded-lg shadow-md transition-all duration-300 ${
                          editingOrder?.orderId === order.id ? 'border-2 border-blue-600' : ''
                        }`}
                      >
                        <div className="mb-4">
                          <p className="text-lg font-semibold text-gray-800">
                            Order #{order.order_number || order.id}
                          </p>
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
                        <h2 className="font-semibold text-lg text-gray-800 mb-2">Items</h2>
                        <ul className="mb-4 space-y-2">
                          {order.items.map((item, index) => (
                            <li key={index} className="flex justify-between text-gray-700">
                              <span>
                                {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}{' '}
                                {item.note && <span className="text-gray-500">({item.note})</span>}
                              </span>
                              <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="font-semibold text-gray-800">
                          Total: ₹
                          {order.items
                            .reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)
                            .toFixed(2)}
                        </p>
                        <button
                          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                          onClick={() => startEditingOrder(order)}
                          aria-label={`Edit order ${order.order_number || order.id}`}
                        >
                          Edit Order
                        </button>
                        {editingOrder?.orderId === order.id && (
                          <p className="mt-2 text-sm text-blue-600" aria-live="polite">
                            Editing this order - review changes in cart below
                          </p>
                        )}
                      </article>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-4" aria-live="polite">
                    <button
                      className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      Previous
                    </button>
                    <p className="text-gray-800">
                      Page {currentPage} of {totalPages}
                    </p>
                    <button
                      className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Bottom Cart */}
        <BottomCart
          cart={cart}
          setCart={setCart}
          onPlaceOrder={() => handleConfirm(editingOrder ? saveEditedOrder : placeOrder)}
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

        {/* Custom Styles */}
        <style jsx>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-in-out;
          }
          @keyframes bounce-once {
            0% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
            100% { transform: translateY(0); }
          }
          .animate-bounce-once {
            animation: bounce-once 0.5s ease-in-out;
          }
          .animate-pulse {
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          #slider-hint {
            opacity: ${isScrolled ? '0' : '1'};
            transition: opacity 0.3s ease;
          }
        `}</style>
      </section>
    </ErrorBoundary>
  );
}