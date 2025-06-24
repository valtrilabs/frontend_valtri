import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { supabase } from '../../lib/supabase';
import BottomCart from '../../components/BottomCart';
import { CakeIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';

const fetcher = (url) => fetch(url).then(res => res.json());

export default function Table() {
  const router = useRouter();
  const { id } = router.query;
  const [cart, setCart] = useState([]);
  const [isAppending, setIsAppending] = useState(false);
  const [appendOrderId, setAppendOrderId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [error, setError] = useState(null);
  const [addedItems, setAddedItems] = useState({});
  const [isLocationValid, setIsLocationValid] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');

  // Validate location on page load
  useEffect(() => {
    if (!id) return;
    const validateLocation = async () => {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        const { latitude, longitude } = position.coords;

        const response = await fetch(`${apiUrl}/api/validate-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude, longitude }),
        });
        const data = await response.json();
        if (!response.ok || !data.isValid) {
          throw new Error(data.error || 'You must be in the cafe to place an order');
        }
        setIsLocationValid(true);
      } catch (err) {
        setIsLocationValid(false);
        setLocationError(err.message || 'Failed to validate location. Please ensure you are in the cafe and location services are enabled.');
      }
    };
    validateLocation();
  }, [id, apiUrl]);

  // Check if user has an active pending order
  useEffect(() => {
    localStorage.removeItem('orderId');
    localStorage.removeItem('appendOrder');

    async function checkActiveOrder() {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, status')
          .eq('table_id', parseInt(id))
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) {
          console.error('Error checking orders:', error.message);
          throw error;
        }
        console.log('Pending orders found for table', id, ':', data);
        if (data.length > 0) {
          const order = data[0];
          console.log('Pending order found, redirecting to /order/', order.id);
          localStorage.setItem('orderId', order.id);
          router.replace(`/order/${order.id}`);
        } else {
          console.log('No pending orders found for table', id, ', allowing menu access');
        }
      } catch (err) {
        console.error('Error checking table orders:', err.message);
      }
    }
    if (isLocationValid) checkActiveOrder();
  }, [id, router, isLocationValid]);

  // Check for append order
  useEffect(() => {
    const appendOrder = localStorage.getItem('appendOrder');
    if (appendOrder) {
      const { orderId, items } = JSON.parse(appendOrder);
      setCart(items);
      setIsAppending(true);
      setAppendOrderId(orderId);
    }
  }, []);

  // Fetch menu items
  const { data: menu, error: fetchError, isLoading } = useSWR(isLocationValid ? `${apiUrl}/api/menu` : null, fetcher);

  // Unique categories
  const categories = ['All', ...new Set(menu?.map(item => item.category).filter(Boolean))];

  // Filtered menu
  const filteredMenu = selectedCategory === 'All' ? menu : menu?.filter(item => item.category === selectedCategory);

  // Handle errors
  useEffect(() => {
    if (fetchError) {
      setError('Failed to load menu. Please try again.');
    }
    if (locationError) {
      setError(locationError);
    }
  }, [fetchError, locationError]);

  // Add to cart with text flash
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
    console.log('Analytics - Item added:', { item_id: item.id, name: item.name, timestamp: new Date().toISOString() });
  };

  // Place new order
  const placeOrder = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    try {
      setError(null);
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      const { latitude, longitude } = position.coords;

      console.log('PlaceOrder - API URL:', apiUrl);
      console.log('PlaceOrder - Payload:', JSON.stringify({ table_id: parseInt(id), items: cart, latitude, longitude }));
      const response = await fetch(`${apiUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: parseInt(id), items: cart, latitude, longitude }),
        signal: AbortSignal.timeout(30000),
      });
      console.log('PlaceOrder - Response status:', response.status);
      const order = await response.json();
      if (!response.ok || !order.id) {
        throw new Error(order.error || `HTTP ${response.status}`);
      }
      localStorage.setItem('orderId', order.id);
      setCart([]);
      setIsCartOpen(false);
      router.replace(`/order/${order.id}`);
    } catch (err) {
      console.error('PlaceOrder error:', err.message);
      setError(err.message || `Failed to place order: ${err.message}`);
    }
  };

  // Update existing order
  const updateOrder = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    try {
      setError(null);
      console.log('UpdateOrder - API URL:', `${apiUrl}/api/orders/${appendOrderId}`);
      console.log('UpdateOrder - Payload:', JSON.stringify({ items: cart }));
      const response = await fetch(`${apiUrl}/api/orders/${appendOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
        signal: AbortSignal.timeout(30000),
      });
      console.log('UpdateOrder - Response status:', response.status);
      const order = await response.json();
      if (!response.ok || !order.id) {
        throw new Error(order.error || `HTTP ${response.status}`);
      }
      localStorage.removeItem('appendOrder');
      setIsAppending(false);
      setAppendOrderId(null);
      localStorage.setItem('orderId', order.id);
      setCart([]);
      setIsCartOpen(false);
      router.replace(`/order/${order.id}`);
    } catch (err) {
      console.error('UpdateOrder error:', err.message);
      setError(`Failed to update order: ${err.message}`);
    }
  };

  // Toggle cart visibility
  const toggleCart = () => {
    setIsCartOpen(prev => !prev);
  };

  if (isLocationValid === null) return <div className="text-center mt-10" role="status">Checking location...</div>;
  if (isLocationValid === false) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Location is required to check you are inside the cafe</h1>
        <p className="mt-4">{error || 'Please ensure you are in the cafe and location services are enabled.'}</p>
        <p className="mt-2">You need to allow location to place the order from QR code. Please clear your browser history, scan the QR code again and Allow location permission or contact the waiter for Manual Order.</p>
      </div>
    </div>
  );
  if (isLoading) return <div className="text-center mt-10" role="status">Loading menu...</div>;
  if (error) return <div className="text-center mt-10 text-red-500" role="alert">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 relative">
      {/* Top-Right Cart Icon */}
      {cart.length > 0 && (
        <button
          className="fixed top-4 right-4 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 z-50"
          onClick={toggleCart}
          aria-label="Toggle cart"
        >
          <ShoppingCartIcon className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {cart.reduce((sum, item) => sum + (item.quantity || 1), 0)}
          </span>
        </button>
      )}

      {/* Welcome Message */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <CakeIcon className="h-6 w-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-800" aria-label="Welcome to Gsaheb Cafe">
          Welcome to Valtri Labs Cafe
        </h1>
        <CakeIcon className="h-6 w-6 text-blue-500" />
      </div>

      {/* Category Filters */}
      <div className="mb-6 overflow-x-auto whitespace-nowrap pb-2" role="tablist" aria-label="Menu categories">
        <div className="flex gap-2">
          {categories.map(category => (
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
              aria-controls="menu-items"
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div
        id="menu-items"
        className="grid grid-cols-2 md:grid-cols-3 gap-4"
        role="region"
        aria-live="polite"
      >
        {filteredMenu?.length === 0 ? (
          <p className="col-span-full text-center text-gray-500">No items in this category.</p>
        ) : (
          filteredMenu.map(item => (
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

      {/* Bottom Cart */}
      <BottomCart
        cart={cart}
        setCart={setCart}
        onPlaceOrder={isAppending ? updateOrder : placeOrder}
        onClose={() => setIsCartOpen(false)}
        isOpen={isCartOpen}
      />
    </div>
  );
}