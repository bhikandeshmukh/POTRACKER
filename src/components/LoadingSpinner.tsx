interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  overlay?: boolean;
}

/**
* Renders a size- and text-configurable loading indicator, optionally centered on an overlay.
* @example
* LoadingSpinner({ size: 'lg', text: 'Loading data...', overlay: true })
* <div className="fixed inset-0 ...">...</div>
* @param {{LoadingSpinnerProps}} {{props}} - Configuration for spinner size, text, and overlay display.
* @returns {{JSX.Element}} JSX element representing the spinner (with optional overlay).
**/
export default function LoadingSpinner({ 
  size = 'md', 
  text = 'Loading...', 
  overlay = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className={`${sizeClasses[size]} border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
      {text && <p className={`text-gray-600 ${textSizes[size]}`}>{text}</p>}
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
}