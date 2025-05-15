import { useState, useEffect } from 'react';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline';

export default function BottomCart({ cart, setCart, onPlaceOrder, onClose, isOpen }) {
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isMinimized, setIsMinimized] = useState(false);

  // Sync visibility with isOpen prop
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsMinimized(false);
    } else {
      setIsMinimized(false);
      setTimeout(() => setIsVisible(false), 300); // Match transition duration
    }
  }, [isOpen]);

  // Update quantity
  const updateQuantity = (itemId, delta) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      const itemIndex = newCart.findIndex(item => item.item_id === itemId);
      if (itemIndex === -1) return prevCart;
      const newQuantity = (newCart[itemIndex].quantity || 1) + delta;
      if (newQuantity <= 0) {
        return newCart.filter((_, index) => index !== itemIndex);
      }
      newCart[itemIndex] = { ...newCart[itemIndex], quantity: newQuantity };
      return newCart;
    });
  };

  // Calculate total and item count
  const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
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
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">You have added</h2>
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
          {cart.length === 0 ? (
            <p className="text-center text-gray-500">Cart is empty</p>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.item_id}-${index}`} className="flex items-center gap-4 mb-4">
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
                </div>
              </div>
            ))
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
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
              onClick={onPlaceOrder}
              aria-label="Place order"
            >
              Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}