import { useState } from 'react';

export default function WaiterCart({ cart, setCart, onPlaceOrder, onClose, isOpen, tableNumber, orderNote, isEditing, menu }) {
  const [itemNotes, setItemNotes] = useState(cart.reduce((acc, item) => {
    acc[item.item_id] = item.note || '';
    return acc;
  }, {}));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

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

  // Filter menu items for dropdown
  const filteredItems = menu
    ? menu.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Add selected item to cart
  const addItemToCart = () => {
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
    setSearchTerm('');
    setSelectedItem(null);
  };

  // Calculate total
  const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-md p-6 rounded-t-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isEditing ? 'Edit Order' : 'Cart'} - Table {tableNumber || 'Not set'}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Cart Items */}
        {cart.length === 0 ? (
          <p className="text-center text-gray-500">Cart is empty</p>
        ) : (
          <div>
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

            {/* Add Item Dropdown (moved to bottom, only during editing) */}
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
                      setSearchTerm(e.target.value);
                      setSelectedItem(null);
                    }}
                    className="w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Search menu items..."
                  />
                  {searchTerm && filteredItems.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                      {filteredItems.map(item => (
                        <li
                          key={item.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setSelectedItem(item);
                            setSearchTerm(item.name);
                          }}
                        >
                          {item.name} - ₹{item.price.toFixed(2)}
                        </li>
                      ))}
                    </ul>
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