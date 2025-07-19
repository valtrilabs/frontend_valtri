import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-500">Redirecting to admin dashboard...</p>
    </div>
  );
}