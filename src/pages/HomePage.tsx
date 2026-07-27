import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RiLayoutMasonryFill } from 'react-icons/ri';
import { formatCode, normalizeCode, isValidNormalizedCode } from '../utils/publishCodes';
import Footer from '../components/Footer';

export default function HomePage() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setValue(formatCode(event.target.value));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeCode(value);
    if (!isValidNormalizedCode(normalized)) {
      setError('Enter a six-character code (ABC-DEF).');
      return;
    }
    navigate(`/${normalized}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          <div className="flex items-center gap-2">
            <RiLayoutMasonryFill className="text-3xl text-[var(--primary-color)]" />
            <h1 className="text-2xl font-bold text-[var(--primary-color)]">Feedback Schedule</h1>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <label htmlFor="schedule-code" className="sr-only">
              Schedule code
            </label>
            <input
              id="schedule-code"
              type="text"
              value={value}
              onChange={handleChange}
              placeholder="ABC-DEF"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              maxLength={7}
              className="w-full text-center text-2xl sm:text-3xl font-mono tracking-widest px-4 py-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
            />
            {error && (
              <p className="text-red-600 dark:text-red-400 text-sm text-center" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-[var(--primary-color)] text-white text-lg font-medium rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-colors"
            >
              View schedule
            </button>
          </form>
        </div>
      </div>

      <div className="flex justify-center px-6 py-4">
        <Link
          to="/create"
          className="text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
        >
          Create a schedule
        </Link>
      </div>
      <Footer />
    </div>
  );
}
