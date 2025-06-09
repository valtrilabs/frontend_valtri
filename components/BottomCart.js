import { useState, useEffect } from 'react';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, MinusIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function BottomCart({ cart, setCart, onPlaceOrder, onClose, isOpen, tableNumber, orderNote, isEditing, menu }) {
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [itemNotes, setItemNotes] = useState(
    cart.reduce((acc, item) => {
      acc[item.item_id] = item.note || '';
      return acc;
    }, {})
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isOnCafeWifi, setIsOnCafeWifi] = useState(false);
  const [wifiCheckError, setWifiCheckError] = useState(null);

  // Check Wi-Fi status
  useEffect(() => {
    async function checkWifiStatus() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'https://backend-supabase-valtri-labs-1.onrender.com';
        const response = await fetch(`${apiUrl}/api/check-wifi`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          throw new Error('Not on café Wi-Fi');
        }
        const data = await response.json();
        setIsOnCafeWifi(data.isOnCafeWifi);
      } catch (err) {
        console.error('Wi-Fi check error:', err.message);
        setWifiCheckError('Please connect to café Wi-Fi to place an order.');
        setIsOnCafeWifi(false);
      }
    }
    checkWifiStatus();
  }, []);

  // Debug log
  useEffect(() => {
    console.log('BottomCart props:', {
      isEditing,
      menuLength: menu?.length,
      searchTerm,
      selectedItem,
      isOpen,
      cartLength: cart.length,
      isOnCafeWifi,
      wifiCheckError,
    });
  }, [isEditing, menu, searchTerm, selectedItem, isOpen, cart, isOnCafeWifi, wifiCheckError]);

  // Sync visibility with isOpen prop
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsMinimized(false);
    } else {
      setIsMinimized(false);
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [isOpen]);

  // Sync itemNotes when cart changes
  useEffect(() => {
    setItemNotes((prev) => {
      const newNotes = { ...prev };
      cart.forEach((item) => {
        if (!(item.item_id in newNotes)) {
          newNotes[item.item_id] = item.note || '';
        }
      });
      return newNotes;
    });
  }, [cart]);

  // Update quantity
  const updateQuantity = (itemId, delta) => {
    setCart((prevCart) => {
      const newCart = [...prevCart];
      const itemIndex = newCart.findIndex((item) => item.item_id === itemId);
      if (itemIndex === -1) return prevCart;
      const newQuantity = (newCart[itemIndex].quantity || 1) + delta;
      if (newQuantity <= 0) {
        return newCart.filter((_, index) => index !== itemIndex);
      }
      newCart[itemIndex] = { ...newCart[itemIndex], quantity: newQuantity };
      return newCart;
    });
  };

  // Delete item
  const deleteItem = (itemId) => {
    setCart((prevCart) => prevCart.filter((item) => item.item_id !== itemId));
    setItemNotes((prev) => {
      const newNotes = { ...prev };
      delete newNotes[itemId];
      return newNotes;
    });
  };

  // Update item note
  const updateItemNote = (itemId, note) => {
    setItemNotes((prev) => ({ ...prev, [itemId]: note }));
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.item_id === itemId ? { ...item, note } : item
      )
    );
  };

  // Filter menu items for dropdown
  const filteredItems = menu
    ? menu.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Add selected item to cart
  const addItemToCart = () => {
    console.log('addItemToCart called:', { selectedItem, searchTerm });
    if (!selectedItem) return;
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.item_id === selectedItem.id);
      if (existingItem) {
        return prevCart.map((cartItem) =>
          cartItem.item_id === selectedItem.id
            ? { ...cartItem, quantity: (cartItem.quantity || 1) + 1 }
            : cartItem
        );
      }
      return [
        ...prevCart,
        {
          item_id: selectedItem.id,
          name: selectedItem.name,
          price: selectedItem.price,
          category: selectedItem.category,
          image_url: selectedItem.image_url || '',
          quantity: 1,
          note: '',
        },
      ];
    });
    setSearchTerm('');
    setSelectedItem(null);
  };

  // Calculate total and item count
  const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Handle minimize/maximize
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white shadow-lg rounded-t-2xl transition-transform duration-300 ease-in-out z-50 ${
        isVisible
          ? isMinimized
            ? 'translate-y-[calc(100%-3rem)]'
            : 'translate-y-0'
          : 'translate-y-full'
      } ${isMinimized ? 'h-12' : 'max-h-[80vh]'} flex flex-col overflow-hidden`}
      role="dialog"
      aria-modal="true"
      aria-label="Cart contents"
    >
      {/* Cart Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">
            {isEditing ? 'Edit Order' : 'Cart'} - Table {tableNumber || 'Not set'}
          </h2>
          {itemCount > 0 && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
        <button
          className="text-gray-600 hover:text-gray-800"
          onClick={cart.length > 0 ? toggleMinimize : onClose}
          aria-label={isMinimized ? 'Maximize cart' : 'Minimize cart'}
        >
          {cart.length > 0 ? (
            isMinimized ? (
              <ArrowUpIcon className="h-6 w-6" />
            ) : (
              <ArrowDownIcon className="h-6 w-6" />
            )
          ) : (
            <ArrowDownIcon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Cart Items (Hidden when minimized) */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4">
          {wifiCheckError && (
            <p className="text-red-500 text-center mb-4">{wifiCheckError}</p>
          )}
          {cart.length === 0 ? (
            <p className="text-center text-gray-500">{isOnCafeWifi ? 'Cart is empty' : 'Connect to café Wi-Fi to add items.'}</p>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.item_id}-${index}`} className="flex flex-col mb-4">
                <div className="flex items-center gap-4">
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349'}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-gray-500">{item.category}</p>
                    <p className="text-sm font-medium">₹{(item.price * (item.quantity || 1)).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                      onClick={() => updateQuantity(item.item_id, -1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center">{item.quantity || 1}</span>
                    <button
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                      onClick={() => updateQuantity(item.item_id, 1)}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1 bg-red-100 rounded hover:bg-red-200"
                      onClick={() => deleteItem(item.item_id)}
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      <TrashIcon className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={itemNotes[item.item_id] || ''}
                  onChange={(e) => updateItemNote(item.item_id, e.target.value)}
                  className="mt-2 w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Item note (e.g., No cheese)"
                />
              </div>
            ))
          )}

          {isEditing && (
            <div className="mt-6">
              <label htmlFor="item-search" className="block text-sm font-medium text-gray-700 mb-2">
                Add New Item
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="item-search"
                  value={searchTerm}
                  onChange={(e) => {
                    console.log('Search input changed:', { value: e.target.value, filteredItems: filteredItems.length });
                    setSearchTerm(e.target.value);
                    setSelectedItem(null);
                  }}
                  className="w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Search menu items..."
                />
                {searchTerm && filteredItems.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mb-1 max-h-40 overflow-y-auto shadow-lg bottom-full">
                    {filteredItems.map((item) => (
                      <li
                        key={item.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          console.log('Dropdown item clicked:', item);
                          setSelectedItem(item);
                          setSearchTerm(item.name);
                        }}
                      >
                        {item.name} - ₹{item.price.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
                {searchTerm && filteredItems.length === 0 && (
                  <p className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mb-1 p-2 text-gray-500">
                    No matching items found
                  </p>
                )}
              </div>
              <button
                onClick={addItemToCart}
                disabled={!selectedItem}
                className={`mt-2 w-full py-2 rounded-lg text-white font-medium ${
                  selectedItem
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Add Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cart Footer (Hidden when minimized) */}
      {!isMinimized && cart.length > 0 && (
        <div className="p-4 border-t">
          <div className="flex justify-between mb-4">
            <span className="font-semibold">Total:</span>
            <span className="font-semibold">₹{total.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
              onClick={onClose}
              aria-label="Close cart"
            >
              Close
            </button>
            <button
              className={`flex-1 text-white py-2 rounded-lg ${
                isOnCafeWifi && cart.length > 0
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
              onClick={isOnCafeWifi ? onPlaceOrder : () => alert('Please connect to café Wi-Fi to place an order.')}
              disabled={!isOnCafeWifi || !cart.length}
              aria-label={isEditing ? 'Save Order Changes' : 'Place Order'}
            >
              {isEditing ? 'Save Order Changes' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}