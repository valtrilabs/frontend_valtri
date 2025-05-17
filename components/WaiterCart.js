import { useState } from 'react';

export default function WaiterCart({ cart, setCart, onPlaceOrder, onClose, isOpen, tableNumber, orderNote, isEditing }) {
  const [itemNotes, setItemNotes] = useState(cart.reduce((acc, item) => {
    acc[item.item_id] = item.note || '';
    return acc;
  }, {}));

  // Update quantity
  const updateQuantity = (itemId, delta) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.item_id === itemId
          ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) }
          : item
      )
    );
  };

  // Remove item
  const removeItem = (itemId) => {
    setCart(prevCart => prevCart.filter(item => item.item_id !== itemId));
    setItemNotes(prev => {
      const newNotes = { ...prev };
      delete newNotes[itemId];
      return newNotes;
    });
  };

  // Update item note
  const updateItemNote = (itemId, note) => {
    setItemNotes(prev => ({ ...prev, [itemId]: note }));
    setCart(prevCart =>
      prevCart.map(item =>
        item.item_id === itemId ? { ...item, note } : item
      )
    );
  };

  // Calculate total
  const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-md p-6 rounded-t-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Cart</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>
        {cart.length === 0 ? (
          <p className="text-center text-gray-500">Cart is empty</p>
        ) : (
          <div>
            <p className="mb-4">Table Number: {tableNumber || 'Not set'}</p>
            <ul className="space-y-4">
              {cart.map(item => (
                <li key={item.item_id} className="flex flex-col">
                  <div className="flex justify-between">
                    <span>
                      {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
                    </span>
                    <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center mt-2">
                    <button
                      className="bg-gray-200 text-gray-700 px-2 py-1 rounded-l"
                      onClick={() => updateQuantity(item.item_id, -1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      -
                    </button>
                    <span className="px-4">{item.quantity || 1}</span>
                    <button
                      className="bg-gray-200 text-gray-700 px-2 py-1 rounded-r"
                      onClick={() => updateQuantity(item.item_id, 1)}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      +
                    </button>
                    <button
                      className="ml-4 text-red-500 hover:text-red-700"
                      onClick={() => removeItem(item.item_id)}
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={itemNotes[item.item_id] || ''}
                    onChange={(e) => updateItemNote(item.item_id, e.target.value)}
                    className="mt-2 w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Item note (e.g., No cheese)"
                  />
                </li>
              ))}
            </ul>
            <p className="mt-4 font-semibold">Total: ₹{total.toFixed(2)}</p>
            <button
              className="mt-6 w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
              onClick={onPlaceOrder}
              aria-label={isEditing ? 'Save Order Changes' : 'Place Order'}
            >
              {isEditing ? 'Save Order Changes' : 'Place Order'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}