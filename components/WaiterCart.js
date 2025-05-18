import { XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function WaiterCart({ cart, setCart, onPlaceOrder, onClose, isOpen, tableNumber, orderNote, isEditing, menu }) {
  const [newItemSearch, setNewItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  // Handle quantity change
  const handleQuantityChange = (itemId, delta) => {
    setCart(prevCart =>
      prevCart
        .map(item =>
          item.item_id === itemId
            ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  // Handle item note change
  const handleItemNoteChange = (itemId, note) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.item_id === itemId ? { ...item, note } : item
      )
    );
  };

  // Remove item
  const removeItem = (itemId) => {
    setCart(prevCart => prevCart.filter(item => item.item_id !== itemId));
  };

  // Add new item to cart
  const addNewItem = () => {
    if (!selectedItem) return;
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.item_id === selectedItem.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
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
          image_url: selectedItem.image_url,
          quantity: 1,
          note: '',
        },
      ];
    });
    setNewItemSearch('');
    setSelectedItem(null);
  };

  // Filter menu items for search
  const filteredMenuItems = menu
    ? menu.filter(item =>
        item.name.toLowerCase().includes(newItemSearch.toLowerCase())
      )
    : [];

  // Total calculation
  const total = cart.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-md h-[80vh] rounded-t-lg p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {isEditing ? 'Edit Order' : 'Your Order'} - Table {tableNumber}
          </h2>
          <button onClick={onClose} aria-label="Close cart">
            <XMarkIcon className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        {/* Add New Item */}
        {isEditing && (
          <div className="mb-4">
            <label htmlFor="new-item-search" className="block text-sm font-medium text-gray-700">
              Add New Item
            </label>
            <div className="relative">
              <input
                type="text"
                id="new-item-search"
                value={newItemSearch}
                onChange={(e) => {
                  setNewItemSearch(e.target.value);
                  setSelectedItem(null);
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Search menu items..."
              />
              {newItemSearch && filteredMenuItems.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto">
                  {filteredMenuItems.map(item => (
                    <li
                      key={item.id}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setSelectedItem(item);
                        setNewItemSearch(item.name);
                      }}
                    >
                      {item.name} - ₹{item.price.toFixed(2)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={addNewItem}
              disabled={!selectedItem}
              className={`mt-2 w-full py-2 rounded-lg text-white ${
                selectedItem
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Add Item to Order
            </button>
          </div>
        )}

        {/* Cart Items */}
        {cart.length === 0 ? (
          <p className="text-center text-gray-500">No items in cart.</p>
        ) : (
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div key={index} className="flex items-start gap-4 border-b pb-4">
                <img
                  src={item.image_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349'}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-md"
                />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h3 className="font-medium">{item.name}</h3>
                    <button
                      onClick={() => removeItem(item.item_id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={`Remove ${item.name}`}
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">₹{item.price.toFixed(2)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleQuantityChange(item.item_id, -1)}
                      className="bg-gray-200 px-2 py-1 rounded"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      -
                    </button>
                    <span>{item.quantity || 1}</span>
                    <button
                      onClick={() => handleQuantityChange(item.item_id, 1)}
                      className="bg-gray-200 px-2 py-1 rounded"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.note || ''}
                    onChange={(e) => handleItemNoteChange(item.item_id, e.target.value)}
                    className="mt-2 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Item note (e.g., No cheese)"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        {cart.length > 0 && (
          <div className="mt-6">
            <p className="text-lg font-semibold">
              Total: ₹{total.toFixed(2)}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-4">
          <button
            onClick={onPlaceOrder}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-lg text-white font-medium ${
              cart.length > 0
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {isEditing ? 'Save Order Changes' : 'Place Order'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
          >
            {isEditing ? 'Cancel Editing' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}