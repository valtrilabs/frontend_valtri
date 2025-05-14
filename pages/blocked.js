export default function Blocked() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Order Completed</h1>
        <p className="mt-4">Your order has been paid. Please scan the QR code again to start a new order.</p>
      </div>
    </div>
  );
}