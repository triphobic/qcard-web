'use client';

// Client Component - Error Boundary
// This file handles all runtime errors in the application

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20">
          <span className="text-red-600 dark:text-red-400 text-2xl font-bold">!</span>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-4">
          Something went wrong!
        </h1>

        <div className="mb-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            The application encountered an unexpected error.
          </p>
          {error.message && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-medium">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full px-4 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Try Again
          </button>

          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full px-4 py-2 font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-blue-600 dark:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    </div>
  );
}