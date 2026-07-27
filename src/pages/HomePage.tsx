import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6">
      <p>Code entry coming soon</p>
      <Link to="/create" className="underline text-blue-600 dark:text-blue-400">
        Create a schedule
      </Link>
    </div>
  );
}
