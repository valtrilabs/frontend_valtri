import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const router = useRouter();

  useEffect(() => {
    // Check if coming from /admin to avoid redirect loop
    const fromAdmin = router.query.from === 'admin';
    if (!fromAdmin) {
      // Redirect to /admin with a query parameter to prevent loop
      router.replace('/admin?from=login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-500">Redirecting to admin dashboard...</p>
    </div>
  );
}