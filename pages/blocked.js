import { useEffect } from 'react';

export default function Blocked() {
  useEffect(() => {
    // Replace the current history entry with /blocked to prevent back navigation
    window.history.replaceState(null, '', '/blocked');
    
    // Prevent back navigation by pushing /blocked again if back is pressed
    const handlePopState = () => {
      window.history.pushState(null, '', '/blocked');
    };
    window.addEventListener('popstate', handlePopState);

    // Cleanup event listener on component unmount
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Order Completed</h1>
        <p className="mt-4">Your order has been paid. Please close this window and Scan the QR code again to start a new order.</p>
      </div>
    </div>
  );
}