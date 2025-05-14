import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome to Café QR Ordering</h1>
        <p className="mt-4">Please scan a table QR code to start ordering.</p>
        <button
          className="mt-6 bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() => router.push('/admin')}
        >
          Admin Login
        </button>
      </div>
    </div>
  );
}