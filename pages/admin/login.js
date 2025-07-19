import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const router = useRouter();

  useEffect(() => {
    // Check if we've recently redirected to prevent loop
    const lastRedirect = localStorage.getItem('adminRedirect');
    const now = Date.now();
    const redirectTimeout = 1000; // 1 second timeout to reset redirect flag

    if (lastRedirect && now - parseInt(lastRedirect) < redirectTimeout) {
      // Loop detected, stay on /admin/login to avoid further redirects
      return;
    }

    // Set redirect flag and redirect to /admin
    localStorage.setItem('adminRedirect', now.toString());
    router.replace('/admin');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-500">Redirecting to admin dashboard...</p>
    </div>
  );
}